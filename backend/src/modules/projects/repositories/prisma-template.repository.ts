import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { TemplateData } from '../domain/template-rules.js';
import type {
  TemplateJobOption,
  TemplateJobRecord,
  TemplateRecord,
  TemplateRepository,
} from './template.repository.js';

const jobInclude = { tasks: { orderBy: { order: 'asc' } } } satisfies Prisma.TemplateJobInclude;
const include = { jobs: { orderBy: { order: 'asc' }, include: jobInclude } } satisfies Prisma.ProjectTemplateInclude;

type JobRow = Prisma.TemplateJobGetPayload<{ include: typeof jobInclude }>;
type Row = Prisma.ProjectTemplateGetPayload<{ include: typeof include }>;

function toJob(row: JobRow): TemplateJobRecord {
  return {
    id: row.id,
    order: row.order,
    title: row.title,
    responsibleId: row.responsibleId,
    statusId: row.statusId,
    briefing: row.briefing,
    tasks: row.tasks.map((task) => ({ title: task.title, responsibleId: task.responsibleId })),
  };
}

function toRecord(row: Row): TemplateRecord {
  return {
    id: row.id,
    title: row.title,
    briefing: row.briefing,
    active: row.active,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    jobs: row.jobs.map(toJob),
  };
}

function jobsInput(data: TemplateData): Prisma.TemplateJobCreateWithoutTemplateInput[] {
  return data.jobs.map((job, order) => ({
    title: job.title,
    responsibleId: job.responsibleId,
    statusId: job.statusId,
    briefing: job.briefing,
    order,
    tasks: { create: job.tasks.map((task, taskOrder) => ({ ...task, order: taskOrder })) },
  }));
}

@Injectable()
export class PrismaTemplateRepository implements TemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: { search?: string; includeInactive: boolean }): Promise<TemplateRecord[]> {
    const rows = await this.prisma.projectTemplate.findMany({
      where: {
        ...(filter.includeInactive ? {} : { active: true }),
        ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' } } : {}),
      },
      include,
      orderBy: { title: 'asc' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<TemplateRecord | null> {
    const row = await this.prisma.projectTemplate.findUnique({ where: { id }, include });
    return row ? toRecord(row) : null;
  }

  async findJob(id: string): Promise<TemplateJobOption | null> {
    const row = await this.prisma.templateJob.findUnique({
      where: { id },
      include: { ...jobInclude, template: { select: { id: true, title: true, active: true } } },
    });
    if (!row || !row.template.active) return null;
    return { ...toJob(row), templateId: row.template.id, templateTitle: row.template.title };
  }

  async listJobs(search?: string): Promise<TemplateJobOption[]> {
    const rows = await this.prisma.templateJob.findMany({
      where: {
        template: { active: true },
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { template: { title: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { ...jobInclude, template: { select: { id: true, title: true } } },
      orderBy: [{ template: { title: 'asc' } }, { order: 'asc' }],
      take: 200,
    });
    return rows.map((row) => ({ ...toJob(row), templateId: row.template.id, templateTitle: row.template.title }));
  }

  async create(data: TemplateData, actorId: string): Promise<TemplateRecord> {
    const row = await this.prisma.projectTemplate.create({
      data: { title: data.title, briefing: data.briefing, createdById: actorId, jobs: { create: jobsInput(data) } },
      include,
    });
    return toRecord(row);
  }

  async replace(id: string, data: TemplateData): Promise<TemplateRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.templateJob.deleteMany({ where: { templateId: id } });
      return tx.projectTemplate.update({
        where: { id },
        data: { title: data.title, briefing: data.briefing, jobs: { create: jobsInput(data) } },
        include,
      });
    });
    return toRecord(row);
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.prisma.projectTemplate.update({ where: { id }, data: { active } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.projectTemplate.delete({ where: { id } });
  }
}
