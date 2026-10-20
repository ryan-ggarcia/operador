import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { localDate } from '../../../shared/time/timezone.js';
import type { UserPermissions } from '../../auth/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import { canEditProject } from '../domain/project-rules.js';
import { withActiveReferences, type TemplateJobData } from '../domain/template-rules.js';
import { JobsService, type JobView } from '../jobs/jobs.service.js';
import { NamingService } from '../naming.service.js';
import { ProjectsService, type ProjectView } from '../projects/projects.service.js';
import { JOB_REPOSITORY, type JobRecord, type JobRepository } from '../repositories/job.repository.js';
import { STATUS_REPOSITORY, type StatusRepository } from '../repositories/status.repository.js';
import { TemplatesService } from '../templates/templates.service.js';
import { shiftInstantDays } from './local-shift.js';
import { projectJobs } from './project-jobs.js';

export interface JobOverrides {
  title?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  briefing?: string | null;
  deadline?: string | null;
  deadlineHasTime?: boolean;
}

export interface JobDestination {
  clientId: string;
  /** Sem projeto, vai para o projeto Geral do cliente. */
  projectId?: string | null;
}

/**
 * Cópias de documentos: aplicar templates (em projeto novo, projeto ou job
 * existente) e duplicar jobs e projetos. Tudo passa pelos services de
 * projetos e jobs, que conferem permissões, cliente ativo e projeto aberto.
 */
@Injectable()
export class DocumentCopyService {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
    private readonly jobsService: JobsService,
    private readonly projectsService: ProjectsService,
    private readonly templates: TemplatesService,
    private readonly naming: NamingService,
  ) {}

  /** Projeto novo com os jobs e tarefas do template (título e briefing do template se não vierem). */
  async createProjectFromTemplate(
    userId: string,
    access: UserPermissions,
    templateId: string,
    input: { clientId: string; title?: string | null; hidden?: boolean },
  ): Promise<ProjectView> {
    const template = await this.templates.get(templateId);
    if (!template.active) throw new BadRequestException('Este template está desativado.');
    const project = await this.projectsService.create(userId, access, {
      title: input.title?.trim() || template.title,
      clientId: input.clientId,
      description: template.briefing,
      hidden: input.hidden,
    });
    await this.insertJobs(userId, access, { clientId: input.clientId, projectId: project.id }, template.jobs);
    return this.projectsService.get(userId, access, project.id);
  }

  /** Insere os jobs e tarefas do template num projeto aberto. */
  async applyTemplateToProject(
    userId: string,
    access: UserPermissions,
    projectId: string,
    templateId: string,
  ): Promise<ProjectView> {
    const project = await this.projectsService.requireViewable(userId, access, projectId);
    if (!canEditProject(userId, access, project)) throw new ForbiddenException('Sem permissão para alterar este projeto.');
    if (project.situation !== 'OPEN') throw new BadRequestException('O projeto está fechado: reabra-o antes.');
    const template = await this.templates.get(templateId);
    if (!template.active) throw new BadRequestException('Este template está desativado.');
    if (template.jobs.length === 0) throw new BadRequestException('Template sem job cadastrado.');
    await this.insertJobs(userId, access, { clientId: project.clientId, projectId }, template.jobs);
    return this.projectsService.get(userId, access, projectId);
  }

  /**
   * Job novo com briefing, responsável, status e tarefas do job de template.
   * Campos informados (responsável, status, briefing, prazo) trocam os do template.
   */
  async createJobFromTemplate(
    userId: string,
    access: UserPermissions,
    templateJobId: string,
    input: JobDestination & JobOverrides,
  ): Promise<JobView> {
    const [templateJob] = await this.clean([await this.templates.requireJob(templateJobId)]);
    const job = await this.jobsService.create(userId, access, {
      title: input.title?.trim() || templateJob!.title,
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      responsibleId: input.responsibleId !== undefined ? input.responsibleId : templateJob!.responsibleId,
      statusId: input.statusId !== undefined ? input.statusId : templateJob!.statusId,
      briefing: input.briefing !== undefined ? input.briefing : templateJob!.briefing,
      deadline: input.deadline,
      deadlineHasTime: input.deadlineHasTime,
    });
    for (const task of templateJob!.tasks) {
      await this.jobsService.createTask(userId, access, job.id, task);
    }
    return this.jobsService.get(userId, access, job.id);
  }

  /** Acrescenta as tarefas do job de template a um job existente. */
  async applyTemplateToJob(userId: string, access: UserPermissions, jobId: string, templateJobId: string): Promise<JobView> {
    await this.jobsService.requireViewable(userId, access, jobId);
    const templateJob = (await this.clean([await this.templates.requireJob(templateJobId)]))[0]!;
    if (templateJob.tasks.length === 0) throw new BadRequestException('Este job de template não tem tarefas.');
    for (const task of templateJob.tasks) {
      await this.jobsService.createTask(userId, access, jobId, task);
    }
    return this.jobsService.get(userId, access, jobId);
  }

  /** Duplica o job (com tarefas não canceladas, reabertas) para o cliente e projeto escolhidos. */
  async duplicateJob(userId: string, access: UserPermissions, jobId: string, destination: JobDestination): Promise<JobView> {
    const source = await this.jobsService.requireViewable(userId, access, jobId);
    const id = await this.copyJob(userId, access, source, destination);
    return this.jobsService.get(userId, access, id);
  }

  /**
   * Duplica o projeto com os jobs (e tarefas) que não foram cancelados.
   * Mídias e produções ainda não são copiadas.
   */
  async duplicateProject(userId: string, access: UserPermissions, projectId: string, clientId: string): Promise<ProjectView> {
    const source = await this.projectsService.requireViewable(userId, access, projectId);
    const project = await this.projectsService.create(userId, access, {
      title: source.title,
      clientId,
      description: source.description,
      hidden: source.hidden && access.flags.hiddenProjects,
    });
    const members = [...(await this.naming.activeUserIds(source.memberIds))].filter((id) => id !== userId);
    if (members.length > 0) await this.projectsService.addMembers(userId, access, project.id, members);
    for (const job of await projectJobs(this.jobs, projectId, userId)) {
      await this.copyJob(userId, access, job, { clientId, projectId: project.id });
    }
    return this.projectsService.get(userId, access, project.id);
  }

  /**
   * Copia o job (e as tarefas não canceladas, reabertas) para o destino.
   * `shiftDays` desloca início e prazos do job e das tarefas (recorrência).
   */
  async copyJob(
    userId: string,
    access: UserPermissions,
    source: JobRecord,
    destination: JobDestination,
    shiftDays = 0,
  ): Promise<string> {
    const timezone = (await this.settings.getAgency()).timezone;
    const shift = (date: Date | null) => (date ? shiftInstantDays(date, shiftDays, timezone) : null);
    const tasks = (await this.jobs.listTasks(source.id))
      .filter((task) => task.situation !== 'CANCELED')
      .sort((a, b) => a.order - b.order);
    const active = await this.naming.activeUserIds(
      [source.responsibleId, ...source.memberIds, ...tasks.map((task) => task.responsibleId)].filter(
        (id): id is string => Boolean(id),
      ),
    );
    const statuses = await this.activeStatusIds();
    const sameClient = destination.clientId === source.clientId;
    const deadline = shift(source.deadline);
    const job = await this.jobsService.create(userId, access, {
      title: source.title,
      clientId: destination.clientId,
      projectId: destination.projectId ?? null,
      clientContactId: sameClient ? source.clientContactId : null,
      responsibleId: source.responsibleId && active.has(source.responsibleId) ? source.responsibleId : null,
      statusId: source.statusId && statuses.has(source.statusId) ? source.statusId : null,
      startAt: shift(source.startAt),
      deadline: deadline ? (source.deadlineHasTime ? deadline.toISOString() : localDate(deadline, timezone)) : null,
      deadlineHasTime: Boolean(deadline) && source.deadlineHasTime,
      estimatedMinutes: source.estimatedMinutes,
      briefing: source.briefing,
      memberIds: source.memberIds.filter((id) => active.has(id) && id !== userId),
    });
    for (const task of tasks) {
      await this.jobsService.createTask(userId, access, job.id, {
        title: task.title,
        responsibleId: task.responsibleId && active.has(task.responsibleId) ? task.responsibleId : null,
        statusId: task.statusId && statuses.has(task.statusId) ? task.statusId : null,
        startAt: shift(task.startAt),
        deadline: shift(task.deadline),
      });
    }
    return job.id;
  }

  /** Cria os jobs (e tarefas) em ordem; responsáveis e status inativos ficam vazios. */
  private async insertJobs(
    userId: string,
    access: UserPermissions,
    destination: JobDestination,
    templateJobs: TemplateJobData[],
  ): Promise<JobView[]> {
    const created: JobView[] = [];
    for (const templateJob of await this.clean(templateJobs)) {
      const job = await this.jobsService.create(userId, access, {
        title: templateJob.title,
        clientId: destination.clientId,
        projectId: destination.projectId ?? null,
        responsibleId: templateJob.responsibleId,
        statusId: templateJob.statusId,
        briefing: templateJob.briefing,
      });
      for (const task of templateJob.tasks) {
        await this.jobsService.createTask(userId, access, job.id, task);
      }
      created.push(job);
    }
    return created;
  }

  private async clean(templateJobs: TemplateJobData[]): Promise<TemplateJobData[]> {
    const users = await this.naming.activeUserIds(
      templateJobs.flatMap((job) => [job.responsibleId, ...job.tasks.map((task) => task.responsibleId)]).filter(
        (id): id is string => Boolean(id),
      ),
    );
    const statuses = await this.activeStatusIds();
    return templateJobs.map((job) => withActiveReferences(job, users, statuses));
  }

  private async activeStatusIds(): Promise<Set<string>> {
    return new Set((await this.statuses.list('JOB', false)).map((status) => status.id));
  }
}
