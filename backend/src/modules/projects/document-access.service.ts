import { Injectable } from '@nestjs/common';
import type { UserPermissions } from '../auth/public/index.js';
import { canEditJob } from './domain/job-rules.js';
import { canEditProject } from './domain/project-rules.js';
import { JobsService } from './jobs/jobs.service.js';
import { jobTarget, projectTarget, type NotifiedDocument } from './projects-notifier.js';
import { ProjectsService } from './projects/projects.service.js';
import type { ProjectDocType } from './repositories/status.repository.js';

/** O que o usuário pode num projeto ou job, para comentários e aprovações. */
export interface DocumentAccess {
  /** Responsável, solicitante e membros. */
  involvedUserIds: string[];
  /** Pode alterar o documento (fixar comentários, pedir aprovação…). */
  canModerate: boolean;
  responsibleId: string | null;
  document: NotifiedDocument;
}

@Injectable()
export class DocumentAccessService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly jobs: JobsService,
  ) {}

  /** Lança 404 se o documento não existe ou o usuário não pode vê-lo. */
  async resolve(
    userId: string,
    access: UserPermissions,
    docType: ProjectDocType,
    docId: string,
  ): Promise<DocumentAccess> {
    if (docType === 'PROJECT') {
      const project = await this.projects.requireViewable(userId, access, docId);
      return {
        involvedUserIds: [project.responsibleId, project.requesterId, ...project.memberIds].filter(
          (id): id is string => Boolean(id),
        ),
        canModerate: canEditProject(userId, access, project),
        responsibleId: project.responsibleId,
        document: projectTarget(project),
      };
    }
    const job = await this.jobs.requireViewable(userId, access, docId);
    return {
      involvedUserIds: [job.responsibleId, job.requesterId, ...job.memberIds].filter(
        (id): id is string => Boolean(id),
      ),
      canModerate: canEditJob(userId, access, {
        situation: job.situation,
        responsibleId: job.responsibleId,
        requesterId: job.requesterId,
        memberIds: job.memberIds,
        projectHidden: job.projectHidden,
        involvedInProject: job.projectInvolvedIds.includes(userId),
      }),
      responsibleId: job.responsibleId,
      document: jobTarget(job),
    };
  }
}
