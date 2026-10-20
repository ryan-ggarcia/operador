import type { StoredPermissions } from '../domain/permissions.js';

export const USER_ADMIN_REPOSITORY = Symbol('USER_ADMIN_REPOSITORY');

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  color: string | null;
  avatarFileId: string | null;
  accessProfileId: string | null;
  accessProfileName: string | null;
  customPermissions: StoredPermissions | null;
  isOwner: boolean;
  mustChangePassword: boolean;
  collaboratorId: string | null;
  active: boolean;
  lastLoginAt: Date | null;
  teamIds: string[];
}

export interface UserFilter {
  active?: boolean;
  teamId?: string;
  search?: string;
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  accessProfileId: string;
  customPermissions: StoredPermissions | null;
  collaboratorId: string | null;
  color: string | null;
  teamIds: string[];
}

export interface UserChanges {
  name?: string;
  color?: string | null;
  accessProfileId?: string;
  /** null volta a usar o perfil. */
  customPermissions?: StoredPermissions | null;
  teamIds?: string[];
  active?: boolean;
  /** Incrementa permissionsVersion (perfil ou permissões mudaram). */
  bumpPermissions?: boolean;
}

export interface AccessProfileRecord {
  id: string;
  name: string;
  permissions: StoredPermissions;
  system: boolean;
  userCount: number;
}

export interface TeamRecord {
  id: string;
  name: string;
  active: boolean;
  userIds: string[];
}

/** Administração de usuários, perfis de acesso e equipes (schema "auth"). */
export interface UserAdminRepository {
  listUsers(filter: UserFilter): Promise<UserRecord[]>;
  findUser(id: string): Promise<UserRecord | null>;
  /** Dos ids informados, os que existem. */
  existingUserIds(ids: string[]): Promise<string[]>;
  emailInUse(email: string, exceptUserId?: string): Promise<boolean>;
  collaboratorHasUser(collaboratorId: string): Promise<boolean>;
  createUser(data: NewUser): Promise<UserRecord>;
  updateUser(id: string, changes: UserChanges): Promise<UserRecord>;
  /** Grava a senha nova e apaga os refresh tokens do usuário (ver AuthRepository.updatePassword). */
  setPassword(id: string, passwordHash: string, mustChange: boolean): Promise<void>;

  listProfiles(): Promise<AccessProfileRecord[]>;
  findProfile(id: string): Promise<AccessProfileRecord | null>;
  profileNameInUse(name: string, exceptId?: string): Promise<boolean>;
  createProfile(name: string, permissions: StoredPermissions): Promise<AccessProfileRecord>;
  /** Atualiza o perfil e incrementa permissionsVersion de quem o usa. */
  updateProfile(
    id: string,
    changes: { name?: string; permissions?: StoredPermissions },
  ): Promise<{ profile: AccessProfileRecord; affectedUserIds: string[] }>;

  listTeams(): Promise<TeamRecord[]>;
  findTeam(id: string): Promise<TeamRecord | null>;
  teamNameInUse(name: string, exceptId?: string): Promise<boolean>;
  createTeam(name: string, userIds: string[]): Promise<TeamRecord>;
  updateTeam(
    id: string,
    changes: { name?: string; active?: boolean; userIds?: string[] },
  ): Promise<TeamRecord>;
}
