import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PERMISSIONS_CACHE,
  type PermissionsCache,
} from '../domain/permissions-cache.js';
import {
  hasAnyModuleAccess,
  normalizeStoredPermissions,
  resolvePermissions,
  type StoredPermissions,
} from '../domain/permissions.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../password/password-hasher.js';
import {
  COLLABORATOR_REPOSITORY,
  type CollaboratorRepository,
} from '../repositories/collaborator.repository.js';
import {
  USER_ADMIN_REPOSITORY,
  type AccessProfileRecord,
  type TeamRecord,
  type UserAdminRepository,
  type UserFilter,
  type UserRecord,
} from '../repositories/user-admin.repository.js';

export const MIN_PASSWORD_LENGTH = 8;

export interface CreateUserInput {
  email: string;
  name?: string;
  collaboratorId?: string | null;
  accessProfileId: string;
  customPermissions?: unknown;
  teamIds?: string[];
  color?: string | null;
  temporaryPassword: string;
}

export interface UpdateUserInput {
  name?: string;
  color?: string | null;
  accessProfileId?: string;
  /** null volta a usar o perfil. */
  customPermissions?: unknown;
  teamIds?: string[];
}

export interface UserOption {
  id: string;
  name: string;
  color: string | null;
  avatarFileId: string | null;
}

/**
 * Administração de usuários, perfis de acesso e equipes. Na v1 não há envio
 * de e-mail: o administrador define uma senha provisória e o usuário troca
 * no primeiro acesso.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_ADMIN_REPOSITORY) private readonly users: UserAdminRepository,
    @Inject(COLLABORATOR_REPOSITORY)
    private readonly collaborators: CollaboratorRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(PERMISSIONS_CACHE) private readonly cache: PermissionsCache,
  ) {}

  list(filter: UserFilter): Promise<UserRecord[]> {
    return this.users.listUsers(filter);
  }

  /** Usuários ativos para seletores (responsável, envolvidos etc.). */
  async options(): Promise<UserOption[]> {
    const users = await this.users.listUsers({ active: true });
    return users.map(({ id, name, color, avatarFileId }) => ({
      id,
      name,
      color,
      avatarFileId,
    }));
  }

  async get(id: string): Promise<UserRecord> {
    const user = await this.users.findUser(id);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.emailInUse(email)) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }
    assertPassword(input.temporaryPassword);
    const profile = await this.requireProfile(input.accessProfileId);
    const custom =
      input.customPermissions == null
        ? null
        : normalizeStoredPermissions(input.customPermissions);
    assertModuleAccess(profile.permissions, custom);

    let name = input.name?.trim();
    const collaboratorId = input.collaboratorId ?? null;
    if (collaboratorId) {
      const collaborator = await this.collaborators.findById(collaboratorId);
      if (!collaborator) throw new BadRequestException('Colaborador não encontrado.');
      if (await this.users.collaboratorHasUser(collaboratorId)) {
        throw new ConflictException('Este colaborador já tem um usuário.');
      }
      name ||= collaborator.name;
    }
    if (!name) throw new BadRequestException('Informe o nome ou o colaborador.');

    const teamIds = await this.requireTeams(input.teamIds ?? []);
    return this.users.createUser({
      email,
      name,
      passwordHash: await this.hasher.hash(input.temporaryPassword),
      accessProfileId: profile.id,
      customPermissions: custom,
      collaboratorId,
      color: input.color ?? null,
      teamIds,
    });
  }

  async update(id: string, input: UpdateUserInput): Promise<UserRecord> {
    const user = await this.get(id);
    const permissionsChanged =
      input.accessProfileId !== undefined || input.customPermissions !== undefined;

    let custom: StoredPermissions | null | undefined;
    if (input.customPermissions !== undefined) {
      custom =
        input.customPermissions === null
          ? null
          : normalizeStoredPermissions(input.customPermissions);
    }
    if (permissionsChanged) {
      const profileId = input.accessProfileId ?? user.accessProfileId;
      const profile = profileId ? await this.requireProfile(profileId) : null;
      assertModuleAccess(
        profile?.permissions ?? null,
        custom === undefined ? user.customPermissions : custom,
        user.isOwner,
      );
    }

    const updated = await this.users.updateUser(id, {
      name: input.name?.trim() || undefined,
      color: input.color,
      accessProfileId: input.accessProfileId,
      customPermissions: custom,
      teamIds:
        input.teamIds === undefined ? undefined : await this.requireTeams(input.teamIds),
      bumpPermissions: permissionsChanged,
    });
    if (permissionsChanged) this.cache.delete(id);
    return updated;
  }

  /** Desativar no lugar de excluir. O dono e o próprio usuário não saem. */
  async setActive(id: string, active: boolean, actorId: string): Promise<UserRecord> {
    const user = await this.get(id);
    if (!active && user.isOwner) {
      throw new BadRequestException('O dono da conta não pode ser desativado.');
    }
    if (!active && id === actorId) {
      throw new BadRequestException('Você não pode desativar o seu próprio usuário.');
    }
    const updated = await this.users.updateUser(id, { active, bumpPermissions: true });
    this.cache.delete(id);
    return updated;
  }

  /** Define uma senha provisória; o usuário troca no próximo acesso. */
  async resetPassword(id: string, temporaryPassword: string): Promise<void> {
    await this.get(id);
    assertPassword(temporaryPassword);
    await this.users.setPassword(id, await this.hasher.hash(temporaryPassword), true);
  }

  listProfiles(): Promise<AccessProfileRecord[]> {
    return this.users.listProfiles();
  }

  async createProfile(name: string, permissions: unknown): Promise<AccessProfileRecord> {
    const clean = name.trim();
    if (await this.users.profileNameInUse(clean)) {
      throw new ConflictException('Já existe um perfil com este nome.');
    }
    return this.users.createProfile(clean, normalizeStoredPermissions(permissions));
  }

  async updateProfile(
    id: string,
    changes: { name?: string; permissions?: unknown },
  ): Promise<AccessProfileRecord> {
    await this.requireProfile(id);
    const name = changes.name?.trim();
    if (name && (await this.users.profileNameInUse(name, id))) {
      throw new ConflictException('Já existe um perfil com este nome.');
    }
    const { profile, affectedUserIds } = await this.users.updateProfile(id, {
      name,
      permissions:
        changes.permissions === undefined
          ? undefined
          : normalizeStoredPermissions(changes.permissions),
    });
    for (const userId of affectedUserIds) this.cache.delete(userId);
    return profile;
  }

  listTeams(): Promise<TeamRecord[]> {
    return this.users.listTeams();
  }

  async createTeam(name: string, userIds: string[] = []): Promise<TeamRecord> {
    const clean = name.trim();
    if (await this.users.teamNameInUse(clean)) {
      throw new ConflictException('Já existe uma equipe com este nome.');
    }
    return this.users.createTeam(clean, await this.requireUsers(userIds));
  }

  async updateTeam(
    id: string,
    changes: { name?: string; active?: boolean; userIds?: string[] },
  ): Promise<TeamRecord> {
    if (!(await this.users.findTeam(id))) throw new NotFoundException('Equipe não encontrada.');
    const name = changes.name?.trim();
    if (name && (await this.users.teamNameInUse(name, id))) {
      throw new ConflictException('Já existe uma equipe com este nome.');
    }
    return this.users.updateTeam(id, {
      name,
      active: changes.active,
      userIds: changes.userIds === undefined ? undefined : await this.requireUsers(changes.userIds),
    });
  }

  private async requireProfile(id: string): Promise<AccessProfileRecord> {
    const profile = await this.users.findProfile(id);
    if (!profile) throw new BadRequestException('Perfil de acesso não encontrado.');
    return profile;
  }

  private async requireUsers(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    const found = await this.users.existingUserIds(unique);
    if (found.length !== unique.length) throw new BadRequestException('Usuário não encontrado.');
    return unique;
  }

  private async requireTeams(teamIds: string[]): Promise<string[]> {
    const unique = [...new Set(teamIds)];
    const teams = await this.users.listTeams();
    const known = new Set(teams.map((team) => team.id));
    if (unique.some((id) => !known.has(id))) {
      throw new BadRequestException('Equipe não encontrada.');
    }
    return unique;
  }
}

function assertPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }
}

function assertModuleAccess(
  profile: StoredPermissions | null,
  custom: StoredPermissions | null,
  isOwner = false,
): void {
  if (isOwner) return;
  if (!hasAnyModuleAccess(resolvePermissions(profile, custom))) {
    throw new BadRequestException('O usuário precisa de acesso a pelo menos um módulo.');
  }
}
