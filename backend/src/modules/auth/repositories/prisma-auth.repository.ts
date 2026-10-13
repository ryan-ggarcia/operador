import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { StoredPermissions } from '../domain/permissions.js';
import type {
  AuthRepository,
  StoredRefreshToken,
  UserCredentials,
  UserWithPermissions,
} from './auth.repository.js';

const CREDENTIALS = {
  id: true,
  email: true,
  name: true,
  passwordHash: true,
  active: true,
  mustChangePassword: true,
  permissionsVersion: true,
} as const;

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.userAccount.findUnique({
      where: { email },
      select: CREDENTIALS,
    });
  }

  findCredentialsById(id: string): Promise<UserCredentials | null> {
    return this.prisma.userAccount.findUnique({
      where: { id },
      select: CREDENTIALS,
    });
  }

  async findUsersWithPermissions(
    ids: string[],
  ): Promise<UserWithPermissions[]> {
    const users = await this.prisma.userAccount.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        email: true,
        color: true,
        avatarFileId: true,
        active: true,
        isOwner: true,
        customPermissions: true,
        accessProfile: { select: { permissions: true } },
      },
    });
    return users.map(({ accessProfile, customPermissions, ...user }) => ({
      ...user,
      profilePermissions:
        (accessProfile?.permissions as StoredPermissions | undefined) ?? null,
      customPermissions: (customPermissions as StoredPermissions | null) ?? null,
    }));
  }

  async findHourlyRate(userId: string): Promise<number | null> {
    const user = await this.prisma.userAccount.findUnique({
      where: { id: userId },
      select: { collaborator: { select: { hourlyRate: true } } },
    });
    const rate = user?.collaborator?.hourlyRate;
    return rate == null ? null : rate.toNumber();
  }

  async markLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.userAccount.update({
      where: { id: userId },
      data: { lastLoginAt: at },
    });
  }

  async saveRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
  }

  async revokeRefreshToken(id: string, at: Date): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: at },
    });
  }
}
