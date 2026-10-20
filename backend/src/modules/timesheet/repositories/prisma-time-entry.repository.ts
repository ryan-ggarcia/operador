import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Page } from '../../../shared/validation/pagination.js';
import {
  RunningTimerExistsError,
  type DocRef,
  type EntryDocType,
  type NewTimeEntry,
  type ScheduleData,
  type ScheduleRecord,
  type ScheduleRepository,
  type TimeEntryChanges,
  type TimeEntryFilter,
  type TimeEntryRecord,
  type TimeEntryRepository,
  type UserScheduleRecord,
} from './time-entry.repository.js';

type EntryRow = Prisma.TimeEntryGetPayload<object>;

function toRecord({ hourlyCost, updatedById, ...row }: EntryRow): TimeEntryRecord {
  void updatedById;
  return { ...row, hourlyCost: hourlyCost == null ? null : hourlyCost.toNumber() };
}

function docsWhere(docs?: DocRef[]): Prisma.TimeEntryWhereInput | undefined {
  if (!docs) return undefined;
  const parts = docs.filter((doc) => doc.docIds.length > 0);
  // Lista vazia de documentos não pode virar "todos os apontamentos".
  if (parts.length === 0) return { id: { in: [] } };
  return { OR: parts.map((doc) => ({ docType: doc.docType, docId: { in: doc.docIds } })) };
}

@Injectable()
export class PrismaTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: TimeEntryFilter): Promise<Page<TimeEntryRecord> & { totalMinutes: number }> {
    const where: Prisma.TimeEntryWhereInput = {
      AND: [docsWhere(filter.docs) ?? {}],
      userId: filter.userIds ? { in: filter.userIds } : undefined,
      startedAt: filter.from || filter.to ? { gte: filter.from, lt: filter.to } : undefined,
      projectId: filter.projectId,
      clientId: filter.clientId,
      situation: filter.situation,
      source: filter.source,
    };
    const [rows, total, sum] = await this.prisma.$transaction([
      this.prisma.timeEntry.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.timeEntry.count({ where }),
      this.prisma.timeEntry.aggregate({ where, _sum: { minutes: true } }),
    ]);
    return { items: rows.map(toRecord), total, totalMinutes: sum._sum.minutes ?? 0 };
  }

  async findById(id: string): Promise<TimeEntryRecord | null> {
    const row = await this.prisma.timeEntry.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findRunningByUser(userId: string): Promise<TimeEntryRecord | null> {
    const row = await this.prisma.timeEntry.findFirst({ where: { userId, situation: 'RUNNING' } });
    return row ? toRecord(row) : null;
  }

  async findRunning(filter: { docs?: DocRef[]; projectId?: string }): Promise<TimeEntryRecord[]> {
    const rows = await this.prisma.timeEntry.findMany({
      where: { AND: [docsWhere(filter.docs) ?? {}], projectId: filter.projectId, situation: 'RUNNING' },
      orderBy: { startedAt: 'asc' },
    });
    return rows.map(toRecord);
  }

  async create(data: NewTimeEntry, actorId: string): Promise<TimeEntryRecord> {
    try {
      const row = await this.prisma.timeEntry.create({ data: { ...data, updatedById: actorId } });
      return toRecord(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new RunningTimerExistsError();
      }
      throw error;
    }
  }

  async update(id: string, changes: TimeEntryChanges, actorId: string): Promise<TimeEntryRecord> {
    const row = await this.prisma.timeEntry.update({
      where: { id },
      data: { ...changes, updatedById: actorId },
    });
    return toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.timeEntry.delete({ where: { id } });
  }

  async sumMinutes(docs: DocRef[]): Promise<{ docType: EntryDocType; docId: string; minutes: number }[]> {
    const groups = await this.prisma.timeEntry.groupBy({
      by: ['docType', 'docId'],
      where: { AND: [docsWhere(docs) ?? {}], situation: 'DONE' },
      _sum: { minutes: true },
    });
    return groups.map((group) => ({
      docType: group.docType,
      docId: group.docId,
      minutes: group._sum.minutes ?? 0,
    }));
  }
}

type ScheduleRow = Prisma.WorkScheduleGetPayload<object>;

function toSchedule({ createdAt, updatedAt, periods, ...row }: ScheduleRow): ScheduleRecord {
  void createdAt;
  void updatedAt;
  return { ...row, periods: periods as ScheduleRecord['periods'] };
}

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

@Injectable()
export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ScheduleRecord[]> {
    const rows = await this.prisma.workSchedule.findMany({
      where: { active: true },
      orderBy: [{ isDefault: 'desc' }, { title: 'asc' }],
    });
    return rows.map(toSchedule);
  }

  async findById(id: string): Promise<ScheduleRecord | null> {
    const row = await this.prisma.workSchedule.findFirst({ where: { id, active: true } });
    return row ? toSchedule(row) : null;
  }

  async findDefault(): Promise<ScheduleRecord | null> {
    const row = await this.prisma.workSchedule.findFirst({ where: { isDefault: true } });
    return row ? toSchedule(row) : null;
  }

  async create(data: ScheduleData, isDefault: boolean): Promise<ScheduleRecord> {
    const row = await this.prisma.workSchedule.create({
      data: { ...data, periods: data.periods as Prisma.InputJsonValue, isDefault },
    });
    return toSchedule(row);
  }

  async update(id: string, data: Partial<ScheduleData>): Promise<ScheduleRecord> {
    const row = await this.prisma.workSchedule.update({
      where: { id },
      data: { ...data, periods: data.periods as Prisma.InputJsonValue | undefined },
    });
    return toSchedule(row);
  }

  async makeDefault(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.workSchedule.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.workSchedule.update({ where: { id }, data: { isDefault: true } }),
    ]);
  }

  async remove(id: string, moveTo: string, validFrom: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const users = await tx.userSchedule.findMany({
        where: { scheduleId: id },
        distinct: ['userId'],
        select: { userId: true },
      });
      for (const { userId } of users) {
        await tx.userSchedule.upsert({
          where: { userId_validFrom: { userId, validFrom: toDate(validFrom) } },
          update: { scheduleId: moveTo },
          create: { userId, scheduleId: moveTo, validFrom: toDate(validFrom) },
        });
      }
      // A jornada some das listas; as atribuições antigas ficam no histórico.
      await tx.workSchedule.update({ where: { id }, data: { active: false } });
    });
  }

  async listAssignments(): Promise<UserScheduleRecord[]> {
    const rows = await this.prisma.userSchedule.findMany({ orderBy: { validFrom: 'asc' } });
    return rows.map((row) => ({
      userId: row.userId,
      scheduleId: row.scheduleId,
      validFrom: row.validFrom.toISOString().slice(0, 10),
    }));
  }

  async assign(userIds: string[], scheduleId: string, validFrom: string): Promise<void> {
    await this.prisma.$transaction(
      userIds.map((userId) =>
        this.prisma.userSchedule.upsert({
          where: { userId_validFrom: { userId, validFrom: toDate(validFrom) } },
          update: { scheduleId },
          create: { userId, scheduleId, validFrom: toDate(validFrom) },
        }),
      ),
    );
  }
}
