import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { FieldChange } from '../../../shared/history/diff.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { ProjectSituation } from '../domain/project-rules.js';
import type {
  HistoryEntry,
  JobCascade,
  NewProject,
  ProjectChanges,
  ProjectFilter,
  ProjectListItem,
  ProjectRecord,
  ProjectRepository,
  ProjectVisibility,
} from './project.repository.js';

export const CLIENT_DEFAULT_PROJECT_TITLE = 'Geral';

const PROJECT_INCLUDE = {
  members: { select: { userId: true } },
} satisfies Prisma.ProjectInclude;

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

function toRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    clientId: row.clientId,
    description: row.description,
    requesterId: row.requesterId,
    responsibleId: row.responsibleId,
    statusId: row.statusId,
    situation: row.situation,
    hidden: row.hidden,
    isClientDefault: row.isClientDefault,
    desiredDeadline: row.desiredDeadline,
    budget: row.budget.toNumber(),
    lastDocumentSequence: row.lastDocumentSequence,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberIds: row.members.map((member) => member.userId),
  };
}

export function involvedWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { responsibleId: userId },
      { requesterId: userId },
      { members: { some: { userId } } },
    ],
  };
}

/** Mesma regra de canViewProject, como filtro do banco. */
export function projectVisibilityWhere(visibility: ProjectVisibility): Prisma.ProjectWhereInput {
  const involved = involvedWhere(visibility.userId);
  if (!visibility.readAll) return involved;
  if (visibility.allHidden) return {};
  return { OR: [{ hidden: false }, involved] };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ProjectFilter): Promise<Page<ProjectListItem>> {
    const userId = filter.visibility.userId;
    const statusFilter: Prisma.ProjectWhereInput[] = [];
    if (filter.statusIds?.length) statusFilter.push({ statusId: { in: filter.statusIds } });
    if (filter.withoutStatus) statusFilter.push({ statusId: null });

    const where: Prisma.ProjectWhereInput = {
      AND: [
        projectVisibilityWhere(filter.visibility),
        filter.search
          ? {
              OR: [
                { title: { contains: filter.search, mode: 'insensitive' } },
                ...(/^\d+$/.test(filter.search) ? [{ number: Number(filter.search) }] : []),
              ],
            }
          : {},
        statusFilter.length ? { OR: statusFilter } : {},
      ],
      situation: filter.situations?.length ? { in: filter.situations } : undefined,
      clientId: filter.clientId,
      responsibleId: filter.responsibleId,
      favorites: filter.favoritesOnly ? { some: { userId } } : undefined,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: {
          ...PROJECT_INCLUDE,
          favorites: { where: { userId }, select: { userId: true } },
          _count: { select: { jobs: true } },
        },
        orderBy: { number: 'desc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.project.count({ where }),
    ]);

    const openJobs = rows.length
      ? await this.prisma.job.groupBy({
          by: ['projectId'],
          where: { projectId: { in: rows.map((row) => row.id) }, situation: 'OPEN' },
          _count: { _all: true },
        })
      : [];
    const openByProject = new Map(openJobs.map((group) => [group.projectId, group._count._all]));

    return {
      total,
      items: rows.map(({ favorites, _count, ...row }) => ({
        ...toRecord(row),
        favorite: favorites.length > 0,
        totalJobs: _count.jobs,
        openJobs: openByProject.get(row.id) ?? 0,
      })),
    };
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const row = await this.prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
    return row ? toRecord(row) : null;
  }

  async findByIds(ids: string[]): Promise<ProjectRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.project.findMany({
      where: { id: { in: ids } },
      include: PROJECT_INCLUDE,
    });
    return rows.map(toRecord);
  }

  async findHiddenIdsNotInvolving(userId: string, ids?: string[]): Promise<string[]> {
    if (ids?.length === 0) return [];
    const rows = await this.prisma.project.findMany({
      where: { hidden: true, id: ids ? { in: ids } : undefined, NOT: involvedWhere(userId) },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async isFavorite(id: string, userId: string): Promise<boolean> {
    const count = await this.prisma.projectFavorite.count({ where: { projectId: id, userId } });
    return count > 0;
  }

  async create(data: NewProject, actorId: string): Promise<ProjectRecord> {
    const members = [...new Set([data.requesterId, data.responsibleId])];
    const row = await this.prisma.project.create({
      data: {
        ...data,
        createdById: actorId,
        updatedById: actorId,
        members: { create: members.map((userId) => ({ userId })) },
      },
      include: PROJECT_INCLUDE,
    });
    return toRecord(row);
  }

  async ensureClientDefault(clientId: string): Promise<ProjectRecord> {
    const find = () =>
      this.prisma.project.findFirst({
        where: { clientId, isClientDefault: true },
        include: PROJECT_INCLUDE,
      });
    const existing = await find();
    if (existing) return toRecord(existing);
    try {
      const row = await this.prisma.project.create({
        data: { clientId, title: CLIENT_DEFAULT_PROJECT_TITLE, isClientDefault: true },
        include: PROJECT_INCLUDE,
      });
      return toRecord(row);
    } catch (error) {
      // Outra requisição criou o projeto Geral ao mesmo tempo.
      if (!isUniqueViolation(error)) throw error;
      const row = await find();
      if (!row) throw error;
      return toRecord(row);
    }
  }

  async update(
    id: string,
    changes: ProjectChanges,
    actorId: string,
    history: FieldChange[],
  ): Promise<ProjectRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (history.length > 0) {
        await tx.projectsHistory.createMany({
          data: history.map((change) => ({
            entityType: 'project',
            entityId: id,
            userId: actorId,
            action: 'update',
            ...change,
          })),
        });
      }
      if (changes.responsibleId) {
        await tx.projectMember.createMany({
          data: [{ projectId: id, userId: changes.responsibleId }],
          skipDuplicates: true,
        });
      }
      return tx.project.update({
        where: { id },
        data: { ...changes, updatedById: actorId },
        include: PROJECT_INCLUDE,
      });
    });
    return toRecord(row);
  }

  async addMembers(id: string, userIds: string[]): Promise<void> {
    await this.prisma.projectMember.createMany({
      data: userIds.map((userId) => ({ projectId: id, userId })),
      skipDuplicates: true,
    });
  }

  async removeMember(id: string, userId: string): Promise<void> {
    await this.prisma.projectMember.deleteMany({ where: { projectId: id, userId } });
  }

  async setFavorite(id: string, userId: string, favorite: boolean): Promise<void> {
    if (favorite) {
      await this.prisma.projectFavorite.createMany({
        data: [{ projectId: id, userId }],
        skipDuplicates: true,
      });
    } else {
      await this.prisma.projectFavorite.deleteMany({ where: { projectId: id, userId } });
    }
  }

  async changeSituation(
    id: string,
    situation: ProjectSituation,
    cascade: JobCascade,
    actorId: string,
  ): Promise<ProjectRecord> {
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const before = await tx.project.findUniqueOrThrow({ where: { id }, select: { situation: true } });
      if (cascade === 'complete') {
        await tx.job.updateMany({
          where: { projectId: id, situation: 'OPEN' },
          data: { situation: 'DONE', closedAt: now, situationChangedById: actorId },
        });
        await tx.task.updateMany({
          where: { job: { projectId: id }, situation: 'OPEN' },
          data: { situation: 'DONE', completedAt: now },
        });
      } else if (cascade === 'cancel') {
        await tx.job.updateMany({
          where: { projectId: id, situation: { not: 'CANCELED' } },
          data: { situation: 'CANCELED', closedAt: now, situationChangedById: actorId },
        });
        await tx.task.updateMany({
          where: { job: { projectId: id }, situation: 'OPEN' },
          data: { situation: 'CANCELED' },
        });
      } else if (cascade === 'reopen') {
        await tx.job.updateMany({
          where: { projectId: id, situation: { not: 'OPEN' } },
          data: { situation: 'OPEN', closedAt: null, situationChangedById: actorId },
        });
      }
      await tx.projectsHistory.create({
        data: {
          entityType: 'project',
          entityId: id,
          userId: actorId,
          action: 'situation',
          field: 'situation',
          oldValue: before.situation,
          newValue: situation,
        },
      });
      return tx.project.update({
        where: { id },
        data: {
          situation,
          closedAt: situation === 'OPEN' ? null : now,
          situationChangedById: actorId,
          updatedById: actorId,
        },
        include: PROJECT_INCLUDE,
      });
    });
    return toRecord(row);
  }

  async reserveDocumentSequence(id: string): Promise<{ number: number; sequence: number }> {
    const row = await this.prisma.project.update({
      where: { id },
      data: { lastDocumentSequence: { increment: 1 } },
      select: { number: true, lastDocumentSequence: true },
    });
    return { number: row.number, sequence: row.lastDocumentSequence };
  }

  countByClient(clientId: string): Promise<number> {
    return this.prisma.project.count({ where: { clientId, isClientDefault: false } });
  }

  listHistory(entityType: 'project' | 'job', entityId: string): Promise<HistoryEntry[]> {
    return this.prisma.projectsHistory.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      omit: { entityType: true, entityId: true },
    });
  }
}
