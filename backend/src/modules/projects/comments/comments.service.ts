import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import type { UserPermissions } from '../../auth/public/index.js';
import { canEditJob } from '../domain/job-rules.js';
import { canEditProject } from '../domain/project-rules.js';
import { JobsService } from '../jobs/jobs.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  COMMENT_REPOSITORY,
  type CommentRecord,
  type CommentRepository,
  type ProjectDocType,
} from '../repositories/status.repository.js';

export interface CommentInput {
  html: string;
  mentionedUserIds?: string[];
  parentId?: string | null;
  fileId?: string | null;
}

interface CommentTarget {
  involvedUserIds: string[];
  canModerate: boolean;
}

/**
 * Comentários (interações) de projetos e jobs. Só os envolvidos podem ser
 * mencionados; cada um edita e apaga só os próprios comentários.
 */
@Injectable()
export class CommentsService {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly projects: ProjectsService,
    private readonly jobs: JobsService,
  ) {}

  async list(userId: string, access: UserPermissions, docType: ProjectDocType, docId: string): Promise<CommentRecord[]> {
    await this.target(userId, access, docType, docId);
    return this.comments.list(docType, docId);
  }

  async create(
    userId: string,
    access: UserPermissions,
    docType: ProjectDocType,
    docId: string,
    input: CommentInput,
  ): Promise<CommentRecord> {
    const target = await this.target(userId, access, docType, docId);
    const html = sanitizeRichText(input.html);
    if (!html) throw new BadRequestException('O comentário está vazio.');
    const mentioned = this.checkMentions(target, input.mentionedUserIds ?? []);
    if (input.parentId) {
      const parent = await this.comments.findById(input.parentId);
      if (!parent || parent.docType !== docType || parent.docId !== docId || !parent.active) {
        throw new BadRequestException('Comentário respondido não encontrado.');
      }
    }
    // TODO(notifications): avisar os mencionados.
    return this.comments.create({
      docType,
      docId,
      authorId: userId,
      html,
      mentionedUserIds: mentioned,
      parentId: input.parentId ?? null,
      fileId: input.fileId ?? null,
    });
  }

  async update(
    userId: string,
    access: UserPermissions,
    id: string,
    input: { html?: string; mentionedUserIds?: string[] },
  ): Promise<CommentRecord> {
    const comment = await this.requireComment(id);
    const target = await this.target(userId, access, comment.docType, comment.docId);
    if (comment.authorId !== userId) throw new ForbiddenException('Só o autor edita o comentário.');
    const html = input.html === undefined ? undefined : sanitizeRichText(input.html);
    if (html === null) throw new BadRequestException('O comentário está vazio.');
    return this.comments.update(id, {
      html,
      mentionedUserIds:
        input.mentionedUserIds === undefined ? undefined : this.checkMentions(target, input.mentionedUserIds),
    });
  }

  async remove(userId: string, access: UserPermissions, id: string): Promise<void> {
    const comment = await this.requireComment(id);
    await this.target(userId, access, comment.docType, comment.docId);
    if (comment.authorId !== userId) throw new ForbiddenException('Só o autor apaga o comentário.');
    await this.comments.update(id, { active: false });
  }

  /** Fixar: quem pode editar o documento. */
  async setPinned(userId: string, access: UserPermissions, id: string, pinned: boolean): Promise<CommentRecord> {
    const comment = await this.requireComment(id);
    const target = await this.target(userId, access, comment.docType, comment.docId);
    if (!target.canModerate) throw new ForbiddenException('Sem permissão para fixar comentários.');
    return this.comments.update(id, { pinned });
  }

  private async requireComment(id: string): Promise<CommentRecord> {
    const comment = await this.comments.findById(id);
    if (!comment || !comment.active) throw new NotFoundException('Comentário não encontrado.');
    return comment;
  }

  private checkMentions(target: CommentTarget, ids: string[]): string[] {
    const unique = [...new Set(ids)];
    if (unique.some((id) => !target.involvedUserIds.includes(id))) {
      throw new BadRequestException('Só os envolvidos podem ser mencionados.');
    }
    return unique;
  }

  private async target(
    userId: string,
    access: UserPermissions,
    docType: ProjectDocType,
    docId: string,
  ): Promise<CommentTarget> {
    if (docType === 'PROJECT') {
      const project = await this.projects.requireViewable(userId, access, docId);
      return {
        involvedUserIds: [project.responsibleId, project.requesterId, ...project.memberIds].filter(
          (id): id is string => Boolean(id),
        ),
        canModerate: canEditProject(userId, access, project),
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
    };
  }
}
