import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diffFields } from '../../../shared/history/diff.js';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import { endOfLocalDay } from '../../../shared/time/timezone.js';
import type { Page } from '../../../shared/validation/pagination.js';
import {
  ADMIN,
  canEditOwn,
  READ_ALL,
  type UserPermissions,
} from '../../auth/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import {
  canActOnJob,
  canCreateJob,
  canEditJob,
  canViewJob,
  documentNumber,
  isOverdue,
  isValidSchedule,
  nextJobSituation,
  type JobAccessView,
  type JobAction,
  type JobSituation,
} from '../domain/job-rules.js';
import { canViewProject } from '../domain/project-rules.js';
import { NamingService, type NamedRef, type ResolvedNames, type UserRef } from '../naming.service.js';
import {
  JOB_REPOSITORY,
  type JobChanges,
  type JobRecord,
  type JobRepository,
  type TaskData,
  type TaskRecord,
} from '../repositories/job.repository.js';
import {
  PROJECT_REPOSITORY,
  type HistoryEntry,
  type ProjectRecord,
  type ProjectRepository,
} from '../repositories/project.repository.js';
import { STATUS_REPOSITORY, type StatusRepository } from '../repositories/status.repository.js';

export interface JobListQuery {
  search?: string;
  situations?: JobSituation[];
  clientId?: string;
  projectId?: string;
  responsibleIds?: string[];
  statusIds?: string[];
  withoutStatus?: boolean;
  mine?: boolean;
  overdue?: boolean;
  deadlineFrom?: Date;
  deadlineTo?: Date;
  orderBy?: 'deadline' | 'createdAt' | 'number';
  limit: number;
  offset: number;
}

/** Prazo como chega da API: data ("AAAA-MM-DD") ou data e hora (ISO). */
export interface DeadlineInput {
  deadline?: string | null;
  deadlineHasTime?: boolean;
}

export interface CreateJobInput extends DeadlineInput {
  title: string;
  clientId: string;
  projectId?: string | null;
  clientContactId?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  startAt?: Date | null;
  estimatedMinutes?: number | null;
  briefing?: string | null;
  memberIds?: string[];
}

export interface UpdateJobInput extends DeadlineInput {
  title?: string;
  clientContactId?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  startAt?: Date | null;
  estimatedMinutes?: number | null;
  briefing?: string | null;
}

export interface JobView {
  id: string;
  number: string;
  title: string;
  project: { id: string; number: number; title: string; situation: string };
  client: NamedRef | null;
  clientContact: NamedRef | null;
  responsible: UserRef | null;
  requester: UserRef | null;
  members: UserRef[];
  statusId: string | null;
  situation: JobSituation;
  startAt: Date | null;
  deadline: Date | null;
  deadlineHasTime: boolean;
  overdue: boolean;
  estimatedMinutes: number | null;
  briefing?: string | null;
  openTasks: number;
  totalTasks: number;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  can: { edit: boolean; act: boolean };
}

export interface TaskInput {
  title?: string;
  responsibleId?: string | null;
  statusId?: string | null;
  startAt?: Date | null;
  deadline?: Date | null;
  order?: number;
}

const HISTORY_FIELDS = [
  'title',
  'clientContactId',
  'responsibleId',
  'statusId',
  'startAt',
  'deadline',
  'deadlineHasTime',
  'estimatedMinutes',
  'briefing',
] as const;

function accessView(userId: string, job: JobRecord): JobAccessView {
  return {
    situation: job.situation,
    responsibleId: job.responsibleId,
    requesterId: job.requesterId,
    memberIds: job.memberIds,
    projectHidden: job.projectHidden,
    involvedInProject: job.projectInvolvedIds.includes(userId),
  };
}

/** Jobs (pautas), tarefas, envolvidos e situação. */
@Injectable()
export class JobsService {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
    private readonly naming: NamingService,
  ) {}

  async list(userId: string, access: UserPermissions, query: JobListQuery): Promise<Page<JobView>> {
    const level = access.modules.jobs;
    const now = new Date();
    const page = await this.jobs.list({
      ...query,
      visibility: { userId, readAll: level >= READ_ALL, allHidden: level >= ADMIN },
      involvedUserId: query.mine ? userId : undefined,
      overdueAt: query.overdue ? now : undefined,
      orderBy: query.orderBy ?? 'deadline',
    });
    const names = await this.resolveNames(page.items);
    return {
      total: page.total,
      items: page.items.map((job) => {
        const view = this.toView(userId, access, job, names, now);
        delete view.briefing;
        return view;
      }),
    };
  }

  async get(userId: string, access: UserPermissions, id: string): Promise<JobView & { tasks: TaskRecord[] }> {
    const job = await this.requireViewable(userId, access, id);
    const [names, tasks] = await Promise.all([this.resolveNames([job]), this.jobs.listTasks(id)]);
    return { ...this.toView(userId, access, job, names, new Date()), tasks };
  }

  /** Job que o usuário pode ver, ou erro (usado também por comentários). */
  async requireViewable(userId: string, access: UserPermissions, id: string): Promise<JobRecord> {
    const job = await this.jobs.findById(id);
    if (!job || !canViewJob(userId, access, accessView(userId, job))) {
      throw new NotFoundException('Job não encontrado.');
    }
    return job;
  }

  async create(userId: string, access: UserPermissions, input: CreateJobInput): Promise<JobView> {
    if (!canCreateJob(access)) throw new ForbiddenException('Sem permissão para criar jobs.');
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título.');
    if (!(await this.naming.isActiveClient(input.clientId))) {
      throw new BadRequestException('Cliente não encontrado ou inativo.');
    }
    // Sem projeto, o job vai para o projeto "Geral" do cliente.
    const project = input.projectId
      ? await this.requireTargetProject(userId, access, input.projectId, input.clientId)
      : await this.projects.ensureClientDefault(input.clientId);
    if (project.situation !== 'OPEN') {
      throw new BadRequestException('O projeto está fechado: reabra-o antes de incluir jobs.');
    }

    const deadline = await this.parseDeadline(input);
    const startAt = input.startAt ?? null;
    if (!isValidSchedule(startAt, deadline.deadline ?? null)) {
      throw new BadRequestException('O prazo é anterior à data de início.');
    }
    if (input.clientContactId && !(await this.naming.isContactOf(input.clientContactId, input.clientId))) {
      throw new BadRequestException('O contato não é deste cliente.');
    }
    const people = [input.responsibleId, ...(input.memberIds ?? [])].filter(
      (id): id is string => Boolean(id),
    );
    if (!(await this.naming.areActiveUsers(people))) {
      throw new BadRequestException('Usuário não encontrado ou inativo.');
    }
    if (input.statusId) await this.requireStatus(input.statusId);

    const job = await this.jobs.create(
      {
        projectId: project.id,
        title,
        clientId: input.clientId,
        clientContactId: input.clientContactId ?? null,
        responsibleId: input.responsibleId ?? null,
        requesterId: userId,
        statusId: input.statusId ?? null,
        startAt,
        deadline: deadline.deadline ?? null,
        deadlineHasTime: deadline.deadlineHasTime ?? false,
        estimatedMinutes: input.estimatedMinutes ?? null,
        briefing: sanitizeRichText(input.briefing),
        memberIds: input.memberIds ?? [],
      },
      userId,
    );
    return this.get(userId, access, job.id);
  }

  async update(userId: string, access: UserPermissions, id: string, input: UpdateJobInput): Promise<JobView> {
    const job = await this.requireEditable(userId, access, id);
    const changes: JobChanges = {
      title: input.title,
      clientContactId: input.clientContactId,
      responsibleId: input.responsibleId,
      statusId: input.statusId,
      startAt: input.startAt,
      estimatedMinutes: input.estimatedMinutes,
      briefing: input.briefing === undefined ? undefined : sanitizeRichText(input.briefing),
      ...(await this.parseDeadline(input)),
    };
    if (changes.title !== undefined) {
      changes.title = changes.title.trim();
      if (!changes.title) throw new BadRequestException('Informe o título.');
    }
    const startAt = changes.startAt === undefined ? job.startAt : changes.startAt;
    const deadline = changes.deadline === undefined ? job.deadline : changes.deadline;
    if (!isValidSchedule(startAt, deadline)) {
      throw new BadRequestException('O prazo é anterior à data de início.');
    }
    if (changes.clientContactId && !(await this.naming.isContactOf(changes.clientContactId, job.clientId))) {
      throw new BadRequestException('O contato não é deste cliente.');
    }
    if (changes.responsibleId && !(await this.naming.areActiveUsers([changes.responsibleId]))) {
      throw new BadRequestException('Responsável não encontrado ou inativo.');
    }
    if (changes.statusId) await this.requireStatus(changes.statusId);

    await this.jobs.update(id, changes, userId, diffFields(job, changes, HISTORY_FIELDS));
    return this.get(userId, access, id);
  }

  /** Concluir, cancelar ou reabrir. Reabrir exige o projeto aberto. */
  async changeSituation(userId: string, access: UserPermissions, id: string, action: JobAction): Promise<JobView> {
    const job = await this.requireViewable(userId, access, id);
    if (!canActOnJob(userId, access, accessView(userId, job))) {
      throw new ForbiddenException('Sem permissão para alterar este job.');
    }
    const next = nextJobSituation(job.situation, action);
    if (!next) throw new BadRequestException('O job já está nesta situação.');
    if (next === 'OPEN' && job.projectSituation !== 'OPEN') {
      throw new BadRequestException('Reabra o projeto antes de reabrir o job.');
    }
    // TODO(timesheet): não concluir nem cancelar com cronômetro ativo (jobs.md, regra 4).
    await this.jobs.changeSituation(id, next, userId);
    return this.get(userId, access, id);
  }

  /** Mover para outro projeto do mesmo cliente (o número muda). */
  async move(userId: string, access: UserPermissions, id: string, projectId: string): Promise<JobView> {
    const job = await this.requireEditable(userId, access, id);
    if (job.projectId === projectId) throw new BadRequestException('O job já está neste projeto.');
    const project = await this.requireTargetProject(userId, access, projectId, job.clientId);
    if (project.situation !== 'OPEN') throw new BadRequestException('O projeto de destino está fechado.');
    await this.jobs.move(id, projectId, userId);
    return this.get(userId, access, id);
  }

  async addMembers(userId: string, access: UserPermissions, id: string, userIds: string[]): Promise<JobView> {
    await this.requireEditable(userId, access, id);
    if (!(await this.naming.areActiveUsers(userIds))) {
      throw new BadRequestException('Usuário não encontrado ou inativo.');
    }
    await this.jobs.addMembers(id, [...new Set(userIds)]);
    return this.get(userId, access, id);
  }

  async removeMember(userId: string, access: UserPermissions, id: string, memberId: string): Promise<JobView> {
    const job = await this.requireEditable(userId, access, id);
    if (job.responsibleId === memberId) {
      throw new BadRequestException('O responsável não pode sair dos envolvidos.');
    }
    await this.jobs.removeMember(id, memberId);
    return this.get(userId, access, id);
  }

  async history(userId: string, access: UserPermissions, id: string): Promise<HistoryEntry[]> {
    await this.requireViewable(userId, access, id);
    return this.projects.listHistory('job', id);
  }

  async createTask(userId: string, access: UserPermissions, jobId: string, input: TaskInput): Promise<TaskRecord> {
    await this.requireEditable(userId, access, jobId);
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Informe o título da tarefa.');
    const data: TaskData = {
      title,
      responsibleId: input.responsibleId ?? null,
      statusId: input.statusId ?? null,
      startAt: input.startAt ?? null,
      deadline: input.deadline ?? null,
    };
    await this.validateTask(data);
    return this.jobs.createTask(jobId, data, userId);
  }

  async updateTask(userId: string, access: UserPermissions, taskId: string, input: TaskInput): Promise<TaskRecord> {
    const task = await this.requireTask(taskId);
    const job = await this.requireViewable(userId, access, task.jobId);
    this.assertCanTouchTask(userId, access, job, task);
    if (task.situation !== 'OPEN') throw new BadRequestException('A tarefa está fechada.');
    const data = { ...input, title: input.title?.trim() };
    if (data.title === '') throw new BadRequestException('Informe o título da tarefa.');
    await this.validateTask({
      responsibleId: data.responsibleId === undefined ? task.responsibleId : data.responsibleId,
      statusId: data.statusId === undefined ? null : data.statusId,
      startAt: data.startAt === undefined ? task.startAt : data.startAt,
      deadline: data.deadline === undefined ? task.deadline : data.deadline,
    });
    return this.jobs.updateTask(taskId, data, userId);
  }

  async changeTaskSituation(
    userId: string,
    access: UserPermissions,
    taskId: string,
    action: JobAction,
  ): Promise<TaskRecord> {
    const task = await this.requireTask(taskId);
    const job = await this.requireViewable(userId, access, task.jobId);
    this.assertCanTouchTask(userId, access, job, task);
    if (job.situation !== 'OPEN') throw new BadRequestException('Reabra o job antes de mexer nas tarefas.');
    const next = nextJobSituation(task.situation, action);
    if (!next) throw new BadRequestException('A tarefa já está nesta situação.');
    return this.jobs.changeTaskSituation(taskId, next, userId);
  }

  private async requireEditable(userId: string, access: UserPermissions, id: string): Promise<JobRecord> {
    const job = await this.requireViewable(userId, access, id);
    if (!canEditJob(userId, access, accessView(userId, job))) {
      throw new ForbiddenException(
        job.situation === 'OPEN' ? 'Sem permissão para alterar este job.' : 'O job está fechado.',
      );
    }
    return job;
  }

  /** Quem edita o job, ou o responsável pela tarefa (com acesso de edição). */
  private assertCanTouchTask(userId: string, access: UserPermissions, job: JobRecord, task: TaskRecord): void {
    const view = accessView(userId, job);
    const ownsTask = task.responsibleId === userId && canEditOwn(access.modules.jobs);
    if (job.situation !== 'OPEN' || !(canEditJob(userId, access, view) || ownsTask)) {
      throw new ForbiddenException('Sem permissão para alterar esta tarefa.');
    }
  }

  private async requireTask(id: string): Promise<TaskRecord> {
    const task = await this.jobs.findTask(id);
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    return task;
  }

  private async validateTask(data: Omit<TaskData, 'title'>): Promise<void> {
    if (!isValidSchedule(data.startAt, data.deadline)) {
      throw new BadRequestException('O prazo é anterior à data de início.');
    }
    if (data.responsibleId && !(await this.naming.areActiveUsers([data.responsibleId]))) {
      throw new BadRequestException('Responsável não encontrado ou inativo.');
    }
    if (data.statusId) await this.requireStatus(data.statusId);
  }

  /** Projeto de destino: existe, é do mesmo cliente e o usuário enxerga. */
  private async requireTargetProject(
    userId: string,
    access: UserPermissions,
    projectId: string,
    clientId: string,
  ): Promise<ProjectRecord> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new BadRequestException('Projeto não encontrado.');
    if (project.clientId !== clientId) throw new BadRequestException('O projeto é de outro cliente.');
    // Quem não tem acesso a projetos (ex.: criativo) usa projetos visíveis;
    // projeto oculto só para quem o vê.
    if (project.hidden && !canViewProject(userId, access, project)) {
      throw new BadRequestException('Projeto não encontrado.');
    }
    return project;
  }

  private async requireStatus(statusId: string): Promise<void> {
    const status = await this.statuses.findById(statusId);
    if (!status || status.docType !== 'JOB' || !status.active) {
      throw new BadRequestException('Status de job não encontrado.');
    }
  }

  /** Prazo sem hora vale até o fim do dia no fuso da agência. */
  private async parseDeadline(input: DeadlineInput): Promise<Pick<JobChanges, 'deadline' | 'deadlineHasTime'>> {
    if (input.deadline === undefined) {
      return input.deadlineHasTime === undefined ? {} : { deadlineHasTime: input.deadlineHasTime };
    }
    if (input.deadline === null) return { deadline: null, deadlineHasTime: false };
    const hasTime = input.deadlineHasTime ?? input.deadline.includes('T');
    if (hasTime) {
      const deadline = new Date(input.deadline);
      if (Number.isNaN(deadline.getTime())) throw new BadRequestException('Prazo inválido.');
      return { deadline, deadlineHasTime: true };
    }
    const { timezone } = await this.settings.getAgency();
    try {
      return { deadline: endOfLocalDay(input.deadline, timezone), deadlineHasTime: false };
    } catch {
      throw new BadRequestException('Prazo inválido.');
    }
  }

  private resolveNames(jobs: JobRecord[]): Promise<ResolvedNames> {
    return this.naming.resolve({
      clientIds: jobs.map((job) => job.clientId),
      contactIds: jobs.map((job) => job.clientContactId),
      userIds: jobs.flatMap((job) => [job.responsibleId, job.requesterId, ...job.memberIds]),
    });
  }

  private toView(
    userId: string,
    access: UserPermissions,
    job: JobRecord,
    names: ResolvedNames,
    now: Date,
  ): JobView {
    const view = accessView(userId, job);
    return {
      id: job.id,
      number: documentNumber(job.projectNumber, job.sequence),
      title: job.title,
      project: {
        id: job.projectId,
        number: job.projectNumber,
        title: job.projectTitle,
        situation: job.projectSituation,
      },
      client: names.client(job.clientId),
      clientContact: names.contact(job.clientContactId),
      responsible: names.user(job.responsibleId),
      requester: names.user(job.requesterId),
      members: names.users(job.memberIds),
      statusId: job.statusId,
      situation: job.situation,
      startAt: job.startAt,
      deadline: job.deadline,
      deadlineHasTime: job.deadlineHasTime,
      overdue: isOverdue(job, job.statusIgnoresDelay, now),
      estimatedMinutes: job.estimatedMinutes,
      briefing: job.briefing,
      openTasks: job.openTasks,
      totalTasks: job.totalTasks,
      closedAt: job.closedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      can: {
        edit: canEditJob(userId, access, view),
        act: canActOnJob(userId, access, view),
      },
    };
  }
}
