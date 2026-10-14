import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { documentNumber } from './domain/job-rules.js';
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

@Injectable()
export class ProjectsFacadeService implements ProjectsFacade {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
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
    if (docType === 'project') {
      const project = await this.projects.findById(id);
      if (!project) return null;
      return {
        docType,
        id,
        projectId: project.id,
        clientId: project.clientId,
        number: String(project.number),
        title: project.title,
        situation: project.situation,
        involvedUserIds: involved(project),
      };
    }
    const job = await this.jobs.findById(id);
    if (!job) return null;
    return {
      docType,
      id,
      projectId: job.projectId,
      clientId: job.clientId,
      number: documentNumber(job.projectNumber, job.sequence),
      title: job.title,
      situation: job.situation,
      involvedUserIds: involved(job),
    };
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
}
