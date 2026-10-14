import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { UserPermissions } from '../auth/public/index.js';
import { DocumentLifecycleService } from './document-lifecycle.service.js';
import { canViewJob, documentNumber } from './domain/job-rules.js';
import { canViewProject } from './domain/project-rules.js';
import type { DocumentLifecycleListener } from './public/lifecycle.js';
import type {
  DocumentRef,
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
    private readonly lifecycle: DocumentLifecycleService,
  ) {}

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
