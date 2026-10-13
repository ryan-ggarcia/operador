import { Inject, Injectable } from '@nestjs/common';
import { resolvePermissions, type UserPermissions } from './domain/permissions.js';
import type { AuthFacade, UserSummary } from './public/auth.facade.js';
import {
  AUTH_REPOSITORY,
  type AuthRepository,
} from './repositories/auth.repository.js';

@Injectable()
export class AuthFacadeService implements AuthFacade {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
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
    const [user] = await this.repository.findUsersWithPermissions([userId]);
    if (!user || !user.active) return null;
    return resolvePermissions(user.profilePermissions, user.customPermissions);
  }

  getHourlyRate(userId: string): Promise<number | null> {
    return this.repository.findHourlyRate(userId);
  }
}
