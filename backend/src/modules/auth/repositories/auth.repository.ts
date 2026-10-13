import type { StoredPermissions } from '../domain/permissions.js';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface UserCredentials {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  active: boolean;
  mustChangePassword: boolean;
  permissionsVersion: number;
}

export interface UserWithPermissions {
  id: string;
  name: string;
  email: string;
  color: string | null;
  avatarFileId: string | null;
  active: boolean;
  isOwner: boolean;
  profilePermissions: StoredPermissions | null;
  customPermissions: StoredPermissions | null;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Acesso a dados do módulo auth (só o schema "auth"). */
export interface AuthRepository {
  findCredentialsByEmail(email: string): Promise<UserCredentials | null>;
  findCredentialsById(id: string): Promise<UserCredentials | null>;
  findUsersWithPermissions(ids: string[]): Promise<UserWithPermissions[]>;
  findHourlyRate(userId: string): Promise<number | null>;
  markLogin(userId: string, at: Date): Promise<void>;
  saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null>;
  revokeRefreshToken(id: string, at: Date): Promise<void>;
}
