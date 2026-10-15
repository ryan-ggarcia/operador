import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import type { UserPermissions } from '../../auth/public/index.js';
import {
  COMMENT_REPOSITORY,
  type CommentRecord,
  type CommentRepository,
  type ProjectDocType,
} from '../repositories/status.repository.js';
import { DocumentAccessService, type DocumentAccess } from '../document-access.service.js';
import { ProjectsNotifier } from '../projects-notifier.js';

export interface CommentInput {
  html: string;
  mentionedUserIds?: string[];
  parentId?: string | null;
  fileId?: string | null;
}

type CommentTarget = DocumentAccess;

/**
 * Comentários (interações) de projetos e jobs. Só os envolvidos podem ser
 * mencionados; cada um edita e apaga só os próprios comentários.
 */
@Injectable()
export class CommentsService {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    private readonly documents: DocumentAccessService,
    private readonly notifier: ProjectsNotifier,
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
    const comment = await this.comments.create({
      docType,
      docId,
      authorId: userId,
      html,
      mentionedUserIds: mentioned,
      parentId: input.parentId ?? null,
      fileId: input.fileId ?? null,
    });
    const people = { mentionedIds: mentioned, responsibleId: target.responsibleId };
    await this.notifier.commented(target.document, people, userId);
    return comment;
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

  private target(
    userId: string,
    access: UserPermissions,
    docType: ProjectDocType,
    docId: string,
  ): Promise<CommentTarget> {
    return this.documents.resolve(userId, access, docType, docId);
  }
}
