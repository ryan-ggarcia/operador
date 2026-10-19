import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { FieldChange } from '../../../shared/history/diff.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { JobSituation } from '../domain/job-rules.js';
import type {
  JobChanges,
  JobFilter,
  JobRecord,
  JobRecurrence,
  JobRepository,
  JobVisibility,
  NewJob,
  TaskData,
  TaskRecord,
} from './job.repository.js';
import { involvedWhere } from './prisma-project.repository.js';

const JOB_INCLUDE = {
  members: { select: { userId: true } },
  status: { select: { ignoresDelay: true } },
  project: {
    select: {
      number: true,
      title: true,
      hidden: true,
      situation: true,
      responsibleId: true,
      requesterId: true,
      members: { select: { userId: true } },
    },
  },
  _count: { select: { tasks: true } },
} satisfies Prisma.JobInclude;

type JobRow = Prisma.JobGetPayload<{ include: typeof JOB_INCLUDE }>;

const TASK_ARGS = {
  omit: { updatedById: true },
  include: { dependsOn: { select: { dependsOnTaskId: true } } },
} satisfies Prisma.TaskDefaultArgs;

type TaskRow = Prisma.TaskGetPayload<typeof TASK_ARGS>;

function toTask({ dependsOn, ...row }: TaskRow): TaskRecord {
  return { ...row, dependsOnIds: dependsOn.map((link) => link.dependsOnTaskId) };
}

function toRecord(row: JobRow, openTasks: number): JobRecord {
  const { project } = row;
  const projectInvolved = new Set(
    [project.responsibleId, project.requesterId, ...project.members.map((m) => m.userId)].filter(
      (id): id is string => Boolean(id),
    ),
  );
  return {
    id: row.id,
    projectId: row.projectId,
    projectNumber: project.number,
    projectTitle: project.title,
    projectHidden: project.hidden,
    projectSituation: project.situation,
    projectInvolvedIds: [...projectInvolved],
    sequence: row.sequence,
    title: row.title,
    clientId: row.clientId,
    clientContactId: row.clientContactId,
    responsibleId: row.responsibleId,
    requesterId: row.requesterId,
    statusId: row.statusId,
    statusIgnoresDelay: row.status?.ignoresDelay ?? false,
    situation: row.situation,
    startAt: row.startAt,
    deadline: row.deadline,
    deadlineHasTime: row.deadlineHasTime,
    estimatedMinutes: row.estimatedMinutes,
    briefing: row.briefing,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberIds: row.members.map((member) => member.userId),
    recurrence: (row.recurrence as JobRecurrence | null) ?? null,
    openTasks,
    totalTasks: row._count.tasks,
  };
}

function jobInvolvedWhere(userId: string): Prisma.JobWhereInput {
  return {
    OR: [
      { responsibleId: userId },
      { requesterId: userId },
      { members: { some: { userId } } },
    ],
  };
}

/** Mesma regra de canViewJob, como filtro do banco. */
function jobVisibilityWhere(visibility: JobVisibility): Prisma.JobWhereInput {
  const involved = jobInvolvedWhere(visibility.userId);
  if (!visibility.readAll) return involved;
  if (visibility.allHidden) return {};
  return {
    OR: [
      { project: { hidden: false } },
      involved,
      { project: involvedWhere(visibility.userId) },
    ],
  };
}

const ORDER: Record<JobFilter['orderBy'], Prisma.JobOrderByWithRelationInput[]> = {
  deadline: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  createdAt: [{ createdAt: 'desc' }],
  number: [{ project: { number: 'desc' } }, { sequence: 'desc' }],
};

@Injectable()
export class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async withOpenTasks(rows: JobRow[]): Promise<JobRecord[]> {
    if (rows.length === 0) return [];
    const open = await this.prisma.task.groupBy({
      by: ['jobId'],
      where: { jobId: { in: rows.map((row) => row.id) }, situation: 'OPEN' },
      _count: { _all: true },
    });
    const byJob = new Map(open.map((group) => [group.jobId, group._count._all]));
    return rows.map((row) => toRecord(row, byJob.get(row.id) ?? 0));
  }

  async list(filter: JobFilter): Promise<Page<JobRecord>> {
    const and: Prisma.JobWhereInput[] = [jobVisibilityWhere(filter.visibility)];
    if (filter.search) {
      const numbered = /^(\d+)\.(\d+)$/.exec(filter.search);
      and.push({
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          ...(numbered
            ? [{ project: { number: Number(numbered[1]) }, sequence: Number(numbered[2]) }]
            : []),
        ],
      });
    }
    const statusFilter: Prisma.JobWhereInput[] = [];
    if (filter.statusIds?.length) statusFilter.push({ statusId: { in: filter.statusIds } });
    if (filter.withoutStatus) statusFilter.push({ statusId: null });
    if (statusFilter.length) and.push({ OR: statusFilter });
    if (filter.involvedUserId) and.push(jobInvolvedWhere(filter.involvedUserId));
    if (filter.overdueAt) {
      and.push({
        situation: 'OPEN',
        deadline: { lt: filter.overdueAt },
        OR: [{ statusId: null }, { status: { ignoresDelay: false } }],
      });
    }

    const where: Prisma.JobWhereInput = {
      AND: and,
      situation: filter.situations?.length ? { in: filter.situations } : undefined,
      clientId: filter.clientId,
      projectId: filter.projectId,
      responsibleId: filter.responsibleIds?.length ? { in: filter.responsibleIds } : undefined,
      deadline:
        filter.deadlineFrom || filter.deadlineTo
          ? { gte: filter.deadlineFrom, lte: filter.deadlineTo }
          : undefined,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        include: JOB_INCLUDE,
        orderBy: ORDER[filter.orderBy],
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.job.count({ where }),
    ]);
    return { items: await this.withOpenTasks(rows), total };
  }

  async findById(id: string): Promise<JobRecord | null> {
    const row = await this.prisma.job.findUnique({ where: { id }, include: JOB_INCLUDE });
    if (!row) return null;
    const [record] = await this.withOpenTasks([row]);
    return record;
  }

  async findByIds(ids: string[]): Promise<JobRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.job.findMany({
      where: { id: { in: ids } },
      include: JOB_INCLUDE,
    });
    return this.withOpenTasks(rows);
  }

  async create(data: NewJob, actorId: string): Promise<JobRecord> {
    const { memberIds, ...fields } = data;
    const members = [
      ...new Set([data.requesterId, data.responsibleId, ...memberIds].filter(Boolean)),
    ] as string[];
    const row = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: data.projectId },
        data: { lastDocumentSequence: { increment: 1 } },
        select: { lastDocumentSequence: true },
      });
      const job = await tx.job.create({
        data: {
          ...fields,
          sequence: project.lastDocumentSequence,
          createdById: actorId,
          updatedById: actorId,
          members: { create: members.map((userId) => ({ userId })) },
        },
        include: JOB_INCLUDE,
      });
      if (data.briefing) {
        await tx.briefingVersion.create({
          data: { jobId: job.id, html: data.briefing, authorId: actorId },
        });
      }
      return job;
    });
    return toRecord(row, 0);
  }

  async update(
    id: string,
    changes: JobChanges,
    actorId: string,
    history: FieldChange[],
  ): Promise<JobRecord> {
    await this.prisma.$transaction(async (tx) => {
      if (history.length > 0) {
        await tx.projectsHistory.createMany({
          data: history.map((change) => ({
            entityType: 'job',
            entityId: id,
            userId: actorId,
            action: 'update',
            ...change,
          })),
        });
      }
      if (history.some((change) => change.field === 'briefing') && changes.briefing) {
        await tx.briefingVersion.create({
          data: { jobId: id, html: changes.briefing, authorId: actorId },
        });
      }
      if (changes.responsibleId) {
        await tx.jobMember.createMany({
          data: [{ jobId: id, userId: changes.responsibleId }],
          skipDuplicates: true,
        });
      }
      await tx.job.update({ where: { id }, data: { ...changes, updatedById: actorId } });
    });
    return (await this.findById(id))!;
  }

  async addMembers(id: string, userIds: string[]): Promise<void> {
    await this.prisma.jobMember.createMany({
      data: userIds.map((userId) => ({ jobId: id, userId })),
      skipDuplicates: true,
    });
  }

  async removeMember(id: string, userId: string): Promise<void> {
    await this.prisma.jobMember.deleteMany({ where: { jobId: id, userId } });
  }

  async changeSituation(id: string, situation: JobSituation, actorId: string): Promise<JobRecord> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.job.findUniqueOrThrow({ where: { id }, select: { situation: true } });
      await tx.projectsHistory.create({
        data: {
          entityType: 'job',
          entityId: id,
          userId: actorId,
          action: 'situation',
          field: 'situation',
          oldValue: before.situation,
          newValue: situation,
        },
      });
      if (situation !== 'OPEN') {
        // Concluir ou cancelar o job fecha as tarefas abertas junto.
        await tx.task.updateMany({
          where: { jobId: id, situation: 'OPEN' },
          data:
            situation === 'DONE'
              ? { situation: 'DONE', completedAt: now, updatedById: actorId }
              : { situation: 'CANCELED', updatedById: actorId },
        });
      }
      await tx.job.update({
        where: { id },
        data: {
          situation,
          closedAt: situation === 'OPEN' ? null : now,
          situationChangedById: actorId,
          updatedById: actorId,
        },
      });
    });
    return (await this.findById(id))!;
  }

  async move(id: string, projectId: string, actorId: string): Promise<JobRecord> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.job.findUniqueOrThrow({
        where: { id },
        select: { projectId: true },
      });
      const project = await tx.project.update({
        where: { id: projectId },
        data: { lastDocumentSequence: { increment: 1 } },
        select: { lastDocumentSequence: true },
      });
      await tx.projectsHistory.create({
        data: {
          entityType: 'job',
          entityId: id,
          userId: actorId,
          action: 'move',
          field: 'projectId',
          oldValue: before.projectId,
          newValue: projectId,
        },
      });
      await tx.job.update({
        where: { id },
        data: { projectId, sequence: project.lastDocumentSequence, updatedById: actorId },
      });
    });
    return (await this.findById(id))!;
  }

  countOpenByClient(clientId: string): Promise<number> {
    return this.prisma.job.count({ where: { clientId, situation: 'OPEN' } });
  }

  async listTasks(jobId: string): Promise<TaskRecord[]> {
    const rows = await this.prisma.task.findMany({
      where: { jobId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      ...TASK_ARGS,
    });
    return rows.map(toTask);
  }

  async findTask(id: string): Promise<TaskRecord | null> {
    const row = await this.prisma.task.findUnique({ where: { id }, ...TASK_ARGS });
    return row ? toTask(row) : null;
  }

  findTaskIdsByJobs(jobIds: string[]): Promise<{ jobId: string; id: string }[]> {
    if (jobIds.length === 0) return Promise.resolve([]);
    return this.prisma.task.findMany({
      where: { jobId: { in: jobIds } },
      select: { id: true, jobId: true },
    });
  }

  async createTask(jobId: string, data: TaskData, actorId: string): Promise<TaskRecord> {
    const last = await this.prisma.task.aggregate({ where: { jobId }, _max: { order: true } });
    return toTask(
      await this.prisma.task.create({
        data: { ...data, jobId, order: (last._max.order ?? -1) + 1, updatedById: actorId },
        ...TASK_ARGS,
      }),
    );
  }

  async updateTask(
    id: string,
    data: Partial<TaskData> & { order?: number },
    actorId: string,
  ): Promise<TaskRecord> {
    return toTask(
      await this.prisma.task.update({
        where: { id },
        data: { ...data, updatedById: actorId },
        ...TASK_ARGS,
      }),
    );
  }

  async changeTaskSituation(id: string, situation: JobSituation, actorId: string): Promise<TaskRecord> {
    return toTask(
      await this.prisma.task.update({
        where: { id },
        data: {
          situation,
          completedAt: situation === 'DONE' ? new Date() : null,
          updatedById: actorId,
        },
        ...TASK_ARGS,
      }),
    );
  }

  async setRecurrence(id: string, recurrence: JobRecurrence | null): Promise<void> {
    await this.prisma.job.update({
      where: { id },
      data: { recurrence: recurrence ? (recurrence as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
    });
  }

  async replaceDependencies(jobId: string, links: { taskId: string; dependsOnId: string }[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.taskDependency.deleteMany({ where: { task: { jobId } } }),
      this.prisma.taskDependency.createMany({
        data: links.map((link) => ({ taskId: link.taskId, dependsOnTaskId: link.dependsOnId })),
      }),
    ]);
  }

  async setTaskDependencies(taskId: string, dependsOnIds: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.taskDependency.deleteMany({ where: { taskId } }),
      this.prisma.taskDependency.createMany({
        data: dependsOnIds.map((dependsOnTaskId) => ({ taskId, dependsOnTaskId })),
      }),
    ]);
  }
}
