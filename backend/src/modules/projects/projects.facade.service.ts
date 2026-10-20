import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { htmlToText } from '../../shared/html/sanitize.js';
import type { UserPermissions } from '../auth/public/index.js';
import { DocumentLifecycleService } from './document-lifecycle.service.js';
import { JobsService, type JobView } from './jobs/jobs.service.js';
import { NamingService } from './naming.service.js';
import { canViewJob, documentNumber } from './domain/job-rules.js';
import { canViewProject } from './domain/project-rules.js';
import type { DocumentLifecycleListener } from './public/lifecycle.js';
import type {
  DocumentRef,
  JobBrief,
  JobDetail,
  JobSearchQuery,
  JobSummary,
  ProjectDocumentType,
  ProjectsFacade,
  ProjectSummary,
  ReservedSequence,
} from './public/projects.facade.js';
import {
  JOB_REPOSITORY,
  type JobRecord,
  type JobRepository,
} from './repositories/job.repository.js';
import {
  PROJECT_REPOSITORY,
  type ProjectRecord,
  type ProjectRepository,
} from './repositories/project.repository.js';
import { STATUS_REPOSITORY, type StatusRepository } from './repositories/status.repository.js';

const BRIEFING_MAX = 4000;

function jobBrief(job: JobView, statusName: (id: string | null) => string | null): JobBrief {
  return {
    id: job.id,
    number: job.number,
    title: job.title,
    client: job.client?.name ?? null,
    project: { id: job.project.id, number: job.project.number, title: job.project.title },
    responsible: job.responsible?.name ?? null,
    status: statusName(job.statusId),
    situation: job.situation,
    startAt: job.startAt,
    deadline: job.deadline,
    overdue: job.overdue,
    estimatedMinutes: job.estimatedMinutes,
    openTasks: job.openTasks,
    totalTasks: job.totalTasks,
  };
}

export function toProjectSummary(project: ProjectRecord): ProjectSummary {
  return {
    id: project.id,
    number: project.number,
    title: project.title,
    clientId: project.clientId,
    situation: project.situation,
    hidden: project.hidden,
    isClientDefault: project.isClientDefault,
    responsibleId: project.responsibleId,
  };
}

export function toJobSummary(job: JobRecord): JobSummary {
  return {
    id: job.id,
    projectId: job.projectId,
    number: documentNumber(job.projectNumber, job.sequence),
    title: job.title,
    clientId: job.clientId,
    situation: job.situation,
    responsibleId: job.responsibleId,
    statusId: job.statusId,
    deadline: job.deadline,
    estimatedMinutes: job.estimatedMinutes,
  };
}

function involved(item: {
  responsibleId: string | null;
  requesterId: string | null;
  memberIds: string[];
}): string[] {
  return [
    ...new Set(
      [item.responsibleId, item.requesterId, ...item.memberIds].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
}

function jobRef(job: JobRecord): DocumentRef {
  return {
    docType: 'job',
    id: job.id,
    projectId: job.projectId,
    jobId: job.id,
    clientId: job.clientId,
    number: documentNumber(job.projectNumber, job.sequence),
    title: job.title,
    parentTitle: null,
    situation: job.situation,
    open: job.situation === 'OPEN' && job.projectSituation === 'OPEN',
    involvedUserIds: involved(job),
  };
}

@Injectable()
export class ProjectsFacadeService implements ProjectsFacade {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository,
    private readonly lifecycle: DocumentLifecycleService,
    private readonly jobService: JobsService,
    private readonly naming: NamingService,
  ) {}

  async searchJobsForUser(
    userId: string,
    access: UserPermissions,
    query: JobSearchQuery,
  ): Promise<{ total: number; items: JobBrief[] }> {
    // Mesma exigência da rota /jobs (@RequireAccess('jobs')).
    if (access.modules.jobs === 0) throw new ForbiddenException('Sem acesso a jobs.');
    const statuses = await this.statuses.list('JOB', true);
    let statusIds: string[] | undefined;
    if (query.statusName) {
      const term = query.statusName.trim().toLowerCase();
      statusIds = statuses.filter((status) => status.name.toLowerCase().includes(term)).map((status) => status.id);
      if (statusIds.length === 0) {
        const names = statuses.filter((status) => status.active).map((status) => status.name).join(', ');
        throw new BadRequestException(`Nenhum status de job com "${query.statusName}". Status: ${names}.`);
      }
    }
    const page = await this.jobService.list(userId, access, {
      search: query.search,
      clientId: query.clientId,
      situations: query.situations,
      statusIds,
      overdue: query.overdue,
      mine: query.mine,
      limit: query.limit,
      offset: 0,
    });
    const names = new Map(statuses.map((status) => [status.id, status.name]));
    const statusName = (id: string | null) => (id ? (names.get(id) ?? null) : null);
    return { total: page.total, items: page.items.map((job) => jobBrief(job, statusName)) };
  }

  async getJobDetailForUser(userId: string, access: UserPermissions, jobId: string): Promise<JobDetail> {
    const job = await this.jobService.get(userId, access, jobId);
    const [statuses, people] = await Promise.all([
      this.statuses.list('JOB', true),
      this.naming.resolve({ userIds: job.tasks.map((task) => task.responsibleId) }),
    ]);
    const names = new Map(statuses.map((status) => [status.id, status.name]));
    const statusName = (id: string | null) => (id ? (names.get(id) ?? null) : null);
    const briefing = job.briefing ? htmlToText(job.briefing).slice(0, BRIEFING_MAX) : null;
    return {
      ...jobBrief(job, statusName),
      requester: job.requester?.name ?? null,
      members: job.members.map((member) => member.name),
      briefing: briefing || null,
      tasks: job.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        situation: task.situation,
        status: statusName(task.statusId),
        responsible: people.user(task.responsibleId)?.name ?? null,
        startAt: task.startAt,
        deadline: task.deadline,
        blocked: task.blockedByIds.length > 0,
      })),
    };
  }

  async getProject(id: string): Promise<ProjectSummary | null> {
    const project = await this.projects.findById(id);
    return project ? toProjectSummary(project) : null;
  }

  async getProjects(ids: string[]): Promise<ProjectSummary[]> {
    return (await this.projects.findByIds([...new Set(ids)])).map(toProjectSummary);
  }

  async getJobs(ids: string[]): Promise<JobSummary[]> {
    return (await this.jobs.findByIds([...new Set(ids)])).map(toJobSummary);
  }

  async getDocumentRef(docType: ProjectDocumentType, id: string): Promise<DocumentRef | null> {
    return (await this.load(docType, id))?.ref ?? null;
  }

  async getDocumentForUser(
    docType: ProjectDocumentType,
    id: string,
    userId: string,
    access: UserPermissions,
  ): Promise<DocumentRef | null> {
    const loaded = await this.load(docType, id);
    if (!loaded) return null;
    if (loaded.project && !canViewProject(userId, access, loaded.project)) return null;
    if (loaded.job) {
      const visible = canViewJob(userId, access, {
        situation: loaded.job.situation,
        responsibleId: loaded.job.responsibleId,
        requesterId: loaded.job.requesterId,
        memberIds: loaded.job.memberIds,
        projectHidden: loaded.job.projectHidden,
        involvedInProject: loaded.job.projectInvolvedIds.includes(userId),
      });
      if (!visible) return null;
    }
    return loaded.ref;
  }

  getHiddenProjectIdsNotInvolving(userId: string, projectIds?: string[]): Promise<string[]> {
    return this.projects.findHiddenIdsNotInvolving(userId, projectIds && [...new Set(projectIds)]);
  }

  async getTaskIds(jobIds: string[]): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = Object.fromEntries(jobIds.map((id) => [id, []]));
    for (const task of await this.jobs.findTaskIdsByJobs([...new Set(jobIds)])) {
      (result[task.jobId] ??= []).push(task.id);
    }
    return result;
  }

  registerLifecycleListener(listener: DocumentLifecycleListener): void {
    this.lifecycle.register(listener);
  }

  async countByClient(clientId: string): Promise<{ projects: number; openJobs: number }> {
    const [projects, openJobs] = await Promise.all([
      this.projects.countByClient(clientId),
      this.jobs.countOpenByClient(clientId),
    ]);
    return { projects, openJobs };
  }

  async ensureClientDefaultProject(clientId: string): Promise<ProjectSummary> {
    return toProjectSummary(await this.projects.ensureClientDefault(clientId));
  }

  async reserveDocumentSequence(projectId: string): Promise<ReservedSequence> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    if (project.situation !== 'OPEN') {
      throw new BadRequestException('O projeto está fechado: reabra-o antes de incluir documentos.');
    }
    const { number, sequence } = await this.projects.reserveDocumentSequence(projectId);
    return { projectNumber: number, sequence, number: documentNumber(number, sequence) };
  }

  /** Documento com o projeto ou job usado na regra de visibilidade. */
  private async load(
    docType: ProjectDocumentType,
    id: string,
  ): Promise<{ ref: DocumentRef; project?: ProjectRecord; job?: JobRecord } | null> {
    if (docType === 'project') {
      const project = await this.projects.findById(id);
      if (!project) return null;
      return {
        project,
        ref: {
          docType,
          id,
          projectId: project.id,
          jobId: null,
          clientId: project.clientId,
          number: String(project.number),
          title: project.title,
          parentTitle: null,
          situation: project.situation,
          open: project.situation === 'OPEN',
          involvedUserIds: involved(project),
        },
      };
    }
    if (docType === 'job') {
      const job = await this.jobs.findById(id);
      return job ? { job, ref: jobRef(job) } : null;
    }
    const task = await this.jobs.findTask(id);
    if (!task) return null;
    const job = await this.jobs.findById(task.jobId);
    if (!job) return null;
    const parent = jobRef(job);
    return {
      job,
      ref: {
        ...parent,
        docType: 'task',
        id: task.id,
        title: task.title,
        parentTitle: job.title,
        situation: task.situation,
        open: parent.open && task.situation === 'OPEN',
        involvedUserIds: [...new Set([...parent.involvedUserIds, ...(task.responsibleId ? [task.responsibleId] : [])])],
      },
    };
  }
}
