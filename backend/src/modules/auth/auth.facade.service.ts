import { Inject, Injectable } from '@nestjs/common';
import {
  PERMISSIONS_CACHE,
  type PermissionsCache,
} from './domain/permissions-cache.js';
import { resolvePermissions, type UserPermissions } from './domain/permissions.js';
import type { AuthFacade, TeamSummary, UserSummary } from './public/auth.facade.js';
import {
  AUTH_REPOSITORY,
  type AuthRepository,
} from './repositories/auth.repository.js';
import {
  COLLABORATOR_REPOSITORY,
  type CollaboratorRepository,
} from './repositories/collaborator.repository.js';
import {
  USER_ADMIN_REPOSITORY,
  type UserAdminRepository,
} from './repositories/user-admin.repository.js';

@Injectable()
export class AuthFacadeService implements AuthFacade {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(USER_ADMIN_REPOSITORY) private readonly admin: UserAdminRepository,
    @Inject(PERMISSIONS_CACHE) private readonly cache: PermissionsCache,
    @Inject(COLLABORATOR_REPOSITORY) private readonly collaborators: CollaboratorRepository,
  ) {}

  async getUsers(ids: string[]): Promise<UserSummary[]> {
    if (ids.length === 0) return [];
    const users = await this.repository.findUsersWithPermissions(ids);
    return users.map(({ id, name, email, color, avatarFileId, active }) => ({
      id,
      name,
      email,
      color,
      avatarFileId,
      active,
    }));
  }

  async getPermissions(userId: string): Promise<UserPermissions | null> {
    const cached = this.cache.get(userId);
    if (cached) return cached;
    const [user] = await this.repository.findUsersWithPermissions([userId]);
    if (!user || !user.active) return null;
    const permissions = resolvePermissions(
      user.profilePermissions,
      user.customPermissions,
      user.isOwner,
    );
    this.cache.set(userId, permissions);
    return permissions;
  }

  async getCollaboratorNames(ids: string[]): Promise<{ id: string; name: string; active: boolean }[]> {
    if (ids.length === 0) return [];
    const collaborators = await this.collaborators.list({});
    const wanted = new Set(ids);
    return collaborators
      .filter((item) => wanted.has(item.id))
      .map(({ id, name, active }) => ({ id, name, active }));
  }

  async getTeams(): Promise<TeamSummary[]> {
    const teams = await this.admin.listTeams();
    return teams
      .filter((team) => team.active)
      .map(({ id, name, userIds }) => ({ id, name, userIds }));
  }

  getHourlyRate(userId: string): Promise<number | null> {
    return this.repository.findHourlyRate(userId);
  }
}
