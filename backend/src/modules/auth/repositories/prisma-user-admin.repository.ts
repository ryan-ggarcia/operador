import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { StoredPermissions } from '../domain/permissions.js';
import type {
  AccessProfileRecord,
  NewUser,
  TeamRecord,
  UserAdminRepository,
  UserChanges,
  UserFilter,
  UserRecord,
} from './user-admin.repository.js';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  color: true,
  avatarFileId: true,
  accessProfileId: true,
  customPermissions: true,
  isOwner: true,
  mustChangePassword: true,
  collaboratorId: true,
  active: true,
  lastLoginAt: true,
  accessProfile: { select: { name: true } },
  teams: { select: { teamId: true } },
} satisfies Prisma.UserAccountSelect;

type UserRow = Prisma.UserAccountGetPayload<{ select: typeof USER_SELECT }>;

function toUser({ accessProfile, teams, customPermissions, ...row }: UserRow): UserRecord {
  return {
    ...row,
    accessProfileName: accessProfile?.name ?? null,
    customPermissions: (customPermissions as StoredPermissions | null) ?? null,
    teamIds: teams.map((team) => team.teamId),
  };
}

const PROFILE_SELECT = {
  id: true,
  name: true,
  permissions: true,
  system: true,
  _count: { select: { users: true } },
} satisfies Prisma.AccessProfileSelect;

type ProfileRow = Prisma.AccessProfileGetPayload<{ select: typeof PROFILE_SELECT }>;

function toProfile({ _count, permissions, ...row }: ProfileRow): AccessProfileRecord {
  return {
    ...row,
    permissions: permissions as StoredPermissions,
    userCount: _count.users,
  };
}

const TEAM_SELECT = {
  id: true,
  name: true,
  active: true,
  members: { select: { userId: true } },
} satisfies Prisma.TeamSelect;

type TeamRow = Prisma.TeamGetPayload<{ select: typeof TEAM_SELECT }>;

function toTeam({ members, ...row }: TeamRow): TeamRecord {
  return { ...row, userIds: members.map((member) => member.userId) };
}

function sameName(name: string, exceptId?: string) {
  return {
    name: { equals: name, mode: 'insensitive' as const },
    id: exceptId ? { not: exceptId } : undefined,
  };
}

@Injectable()
export class PrismaUserAdminRepository implements UserAdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(filter: UserFilter): Promise<UserRecord[]> {
    const rows = await this.prisma.userAccount.findMany({
      where: {
        active: filter.active,
        teams: filter.teamId ? { some: { teamId: filter.teamId } } : undefined,
        OR: filter.search
          ? [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
    return rows.map(toUser);
  }

  async findUser(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.userAccount.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    return row ? toUser(row) : null;
  }

  async existingUserIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.userAccount.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async emailInUse(email: string, exceptUserId?: string): Promise<boolean> {
    const count = await this.prisma.userAccount.count({
      where: { email, id: exceptUserId ? { not: exceptUserId } : undefined },
    });
    return count > 0;
  }

  async collaboratorHasUser(collaboratorId: string): Promise<boolean> {
    return (await this.prisma.userAccount.count({ where: { collaboratorId } })) > 0;
  }

  async createUser(data: NewUser): Promise<UserRecord> {
    const { teamIds, customPermissions, ...user } = data;
    const row = await this.prisma.userAccount.create({
      data: {
        ...user,
        customPermissions: (customPermissions ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        mustChangePassword: true,
        teams: { create: teamIds.map((teamId) => ({ teamId })) },
      },
      select: USER_SELECT,
    });
    return toUser(row);
  }

  async updateUser(id: string, changes: UserChanges): Promise<UserRecord> {
    const { teamIds, bumpPermissions, customPermissions, ...fields } = changes;
    const row = await this.prisma.$transaction(async (tx) => {
      if (teamIds) {
        await tx.teamMember.deleteMany({ where: { userId: id } });
        await tx.teamMember.createMany({
          data: teamIds.map((teamId) => ({ teamId, userId: id })),
        });
      }
      return tx.userAccount.update({
        where: { id },
        data: {
          ...fields,
          customPermissions:
            customPermissions === undefined
              ? undefined
              : customPermissions === null
                ? Prisma.DbNull
                : (customPermissions as Prisma.InputJsonValue),
          permissionsVersion: bumpPermissions ? { increment: 1 } : undefined,
        },
        select: USER_SELECT,
      });
    });
    return toUser(row);
  }

  async setPassword(id: string, passwordHash: string, mustChange: boolean): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userAccount.update({
        where: { id },
        data: { passwordHash, mustChangePassword: mustChange },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async listProfiles(): Promise<AccessProfileRecord[]> {
    const rows = await this.prisma.accessProfile.findMany({
      select: PROFILE_SELECT,
      orderBy: { name: 'asc' },
    });
    return rows.map(toProfile);
  }

  async findProfile(id: string): Promise<AccessProfileRecord | null> {
    const row = await this.prisma.accessProfile.findUnique({
      where: { id },
      select: PROFILE_SELECT,
    });
    return row ? toProfile(row) : null;
  }

  async profileNameInUse(name: string, exceptId?: string): Promise<boolean> {
    return (await this.prisma.accessProfile.count({ where: sameName(name, exceptId) })) > 0;
  }

  async createProfile(
    name: string,
    permissions: StoredPermissions,
  ): Promise<AccessProfileRecord> {
    const row = await this.prisma.accessProfile.create({
      data: { name, permissions: permissions as Prisma.InputJsonValue },
      select: PROFILE_SELECT,
    });
    return toProfile(row);
  }

  async updateProfile(
    id: string,
    changes: { name?: string; permissions?: StoredPermissions },
  ): Promise<{ profile: AccessProfileRecord; affectedUserIds: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.accessProfile.update({
        where: { id },
        data: {
          name: changes.name,
          permissions: changes.permissions as Prisma.InputJsonValue | undefined,
        },
        select: PROFILE_SELECT,
      });
      const users = changes.permissions
        ? await tx.userAccount.findMany({
            where: { accessProfileId: id },
            select: { id: true },
          })
        : [];
      if (users.length > 0) {
        await tx.userAccount.updateMany({
          where: { accessProfileId: id },
          data: { permissionsVersion: { increment: 1 } },
        });
      }
      return { profile: toProfile(row), affectedUserIds: users.map((user) => user.id) };
    });
  }

  async listTeams(): Promise<TeamRecord[]> {
    const rows = await this.prisma.team.findMany({
      select: TEAM_SELECT,
      orderBy: { name: 'asc' },
    });
    return rows.map(toTeam);
  }

  async findTeam(id: string): Promise<TeamRecord | null> {
    const row = await this.prisma.team.findUnique({ where: { id }, select: TEAM_SELECT });
    return row ? toTeam(row) : null;
  }

  async teamNameInUse(name: string, exceptId?: string): Promise<boolean> {
    return (await this.prisma.team.count({ where: sameName(name, exceptId) })) > 0;
  }

  async createTeam(name: string, userIds: string[]): Promise<TeamRecord> {
    const row = await this.prisma.team.create({
      data: { name, members: { create: userIds.map((userId) => ({ userId })) } },
      select: TEAM_SELECT,
    });
    return toTeam(row);
  }

  async updateTeam(
    id: string,
    changes: { name?: string; active?: boolean; userIds?: string[] },
  ): Promise<TeamRecord> {
    const { userIds, ...fields } = changes;
    const row = await this.prisma.$transaction(async (tx) => {
      if (userIds) {
        await tx.teamMember.deleteMany({ where: { teamId: id } });
        await tx.teamMember.createMany({
          data: userIds.map((userId) => ({ teamId: id, userId })),
        });
      }
      return tx.team.update({ where: { id }, data: fields, select: TEAM_SELECT });
    });
    return toTeam(row);
  }
}
