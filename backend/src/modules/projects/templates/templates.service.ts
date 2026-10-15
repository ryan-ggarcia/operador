import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import { FULL, type UserPermissions } from '../../auth/public/index.js';
import { projectJobs } from '../copy/project-jobs.js';
import { normalizeTemplate, TemplateRuleError, type TemplateData, type TemplateJobData } from '../domain/template-rules.js';
import { JobsService } from '../jobs/jobs.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { JOB_REPOSITORY, type JobRepository } from '../repositories/job.repository.js';
import {
  TEMPLATE_REPOSITORY,
  type TemplateJobOption,
  type TemplateRecord,
  type TemplateRepository,
} from '../repositories/template.repository.js';

export interface TemplateSummary {
  id: string;
  title: string;
  active: boolean;
  createdById: string | null;
  jobsCount: number;
  tasksCount: number;
  /** Os 5 primeiros jobs (o resto vira "+N" na tela). */
  preview: string[];
}

/** Criar, editar e listar templates de projeto (criar e editar: nível Total em projetos). */
@Injectable()
export class TemplatesService {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private readonly templates: TemplateRepository,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly projectsService: ProjectsService,
    private readonly jobsService: JobsService,
  ) {}

  async list(access: UserPermissions, search?: string, includeInactive = false): Promise<TemplateSummary[]> {
    const records = await this.templates.list({ search: search?.trim() || undefined, includeInactive: includeInactive && canManage(access) });
    return records.map((record) => ({
      id: record.id,
      title: record.title,
      active: record.active,
      createdById: record.createdById,
      jobsCount: record.jobs.length,
      tasksCount: record.jobs.reduce((sum, job) => sum + job.tasks.length, 0),
      preview: record.jobs.slice(0, 5).map((job) => job.title),
    }));
  }

  async get(id: string): Promise<TemplateRecord> {
    const template = await this.templates.findById(id);
    if (!template) throw new NotFoundException('Template não encontrado.');
    return template;
  }

  listJobs(search?: string): Promise<TemplateJobOption[]> {
    return this.templates.listJobs(search?.trim() || undefined);
  }

  async requireJob(id: string): Promise<TemplateJobOption> {
    const job = await this.templates.findJob(id);
    if (!job) throw new NotFoundException('Job de template não encontrado.');
    return job;
  }

  async create(userId: string, access: UserPermissions, input: TemplateData): Promise<TemplateRecord> {
    this.requireManager(access);
    return this.templates.create(this.normalize(input), userId);
  }

  async update(access: UserPermissions, id: string, input: TemplateData): Promise<TemplateRecord> {
    this.requireManager(access);
    await this.get(id);
    return this.templates.replace(id, this.normalize(input));
  }

  async setActive(access: UserPermissions, id: string, active: boolean): Promise<void> {
    this.requireManager(access);
    await this.get(id);
    await this.templates.setActive(id, active);
  }

  async remove(access: UserPermissions, id: string): Promise<void> {
    this.requireManager(access);
    await this.get(id);
    await this.templates.delete(id);
  }

  /** Salvar um projeto como template: jobs e tarefas que não foram cancelados. */
  async fromProject(userId: string, access: UserPermissions, projectId: string, title?: string): Promise<TemplateRecord> {
    this.requireManager(access);
    const project = await this.projectsService.requireViewable(userId, access, projectId);
    const templateJobs: TemplateJobData[] = [];
    for (const job of await projectJobs(this.jobs, projectId, userId)) {
      templateJobs.push(await this.templateJobOf(job));
    }
    return this.templates.create(
      this.normalize({ title: title?.trim() || project.title, briefing: project.description, jobs: templateJobs }),
      userId,
    );
  }

  /** Criar template a partir de um job: um template com esse único job. */
  async fromJob(userId: string, access: UserPermissions, jobId: string, title?: string): Promise<TemplateRecord> {
    this.requireManager(access);
    const job = await this.jobsService.requireViewable(userId, access, jobId);
    return this.templates.create(
      this.normalize({ title: title?.trim() || job.title, briefing: null, jobs: [await this.templateJobOf(job)] }),
      userId,
    );
  }

  private async templateJobOf(job: {
    id: string;
    title: string;
    responsibleId: string | null;
    statusId: string | null;
    briefing: string | null;
  }): Promise<TemplateJobData> {
    const tasks = await this.jobs.listTasks(job.id);
    return {
      title: job.title,
      responsibleId: job.responsibleId,
      statusId: job.statusId,
      briefing: job.briefing,
      tasks: tasks
        .filter((task) => task.situation !== 'CANCELED')
        .sort((a, b) => a.order - b.order)
        .map((task) => ({ title: task.title, responsibleId: task.responsibleId })),
    };
  }

  private normalize(input: TemplateData): TemplateData {
    try {
      const template = normalizeTemplate(input);
      return {
        ...template,
        briefing: sanitizeRichText(template.briefing),
        jobs: template.jobs.map((job) => ({ ...job, briefing: sanitizeRichText(job.briefing) })),
      };
    } catch (error) {
      if (error instanceof TemplateRuleError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private requireManager(access: UserPermissions): void {
    if (!canManage(access)) throw new ForbiddenException('Criar e editar templates exige permissão total em projetos.');
  }
}

export function canManage(access: UserPermissions): boolean {
  return access.modules.projects >= FULL;
}
