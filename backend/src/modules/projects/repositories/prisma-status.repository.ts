import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  CommentRecord,
  CommentRepository,
  NewComment,
  PredefinedBriefingRecord,
  ProjectDocType,
  StatusData,
  StatusRecord,
  StatusRepository,
} from './status.repository.js';

@Injectable()
export class PrismaStatusRepository implements StatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(docType: ProjectDocType, includeInactive: boolean): Promise<StatusRecord[]> {
    return this.prisma.projectStatus.findMany({
      where: { docType, active: includeInactive ? undefined : true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<StatusRecord | null> {
    return this.prisma.projectStatus.findUnique({ where: { id } });
  }

  async nameInUse(docType: ProjectDocType, name: string, exceptId?: string): Promise<boolean> {
    const count = await this.prisma.projectStatus.count({
      where: {
        docType,
        name: { equals: name, mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
    });
    return count > 0;
  }

  async create(docType: ProjectDocType, data: StatusData): Promise<StatusRecord> {
    const last = await this.prisma.projectStatus.aggregate({
      where: { docType },
      _max: { order: true },
    });
    return this.prisma.projectStatus.create({
      data: { ...data, docType, order: (last._max.order ?? -1) + 1 },
    });
  }

  update(id: string, data: Partial<StatusData>): Promise<StatusRecord> {
    return this.prisma.projectStatus.update({ where: { id }, data });
  }

  async reorder(docType: ProjectDocType, ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, order) =>
        this.prisma.projectStatus.updateMany({ where: { id, docType }, data: { order } }),
      ),
    );
  }

  listBriefings(docType: ProjectDocType, includeInactive: boolean): Promise<PredefinedBriefingRecord[]> {
    return this.prisma.predefinedBriefing.findMany({
      where: { docType, active: includeInactive ? undefined : true },
      orderBy: { title: 'asc' },
    });
  }

  findBriefing(id: string): Promise<PredefinedBriefingRecord | null> {
    return this.prisma.predefinedBriefing.findUnique({ where: { id } });
  }

  createBriefing(docType: ProjectDocType, title: string, html: string): Promise<PredefinedBriefingRecord> {
    return this.prisma.predefinedBriefing.create({ data: { docType, title, html } });
  }

  updateBriefing(
    id: string,
    data: { title?: string; html?: string; active?: boolean },
  ): Promise<PredefinedBriefingRecord> {
    return this.prisma.predefinedBriefing.update({ where: { id }, data });
  }
}

@Injectable()
export class PrismaCommentRepository implements CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(docType: ProjectDocType, docId: string): Promise<CommentRecord[]> {
    return this.prisma.comment.findMany({
      where: { docType, docId, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<CommentRecord | null> {
    return this.prisma.comment.findUnique({ where: { id } });
  }

  create(data: NewComment): Promise<CommentRecord> {
    return this.prisma.comment.create({ data });
  }

  update(
    id: string,
    data: { html?: string; mentionedUserIds?: string[]; pinned?: boolean; active?: boolean },
  ): Promise<CommentRecord> {
    return this.prisma.comment.update({ where: { id }, data });
  }
}
