import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { ApprovalSituation } from '../domain/approval-rules.js';
import type {
  ApprovalMarkerRecord,
  ApprovalRecord,
  ApprovalRepository,
  ApprovalVoteRecord,
  NewApproval,
} from './approval.repository.js';
import type { ProjectDocType } from './status.repository.js';

const include = {
  votes: { orderBy: { createdAt: 'asc' } },
  markers: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ApprovalRequestInclude;

type Row = Prisma.ApprovalRequestGetPayload<{ include: typeof include }>;

function toRecord(row: Row): ApprovalRecord {
  return {
    ...row,
    votes: row.votes.map(({ userId, decision, reason, createdAt }) => ({ userId, decision, reason, createdAt })),
    markers: row.markers.map(({ id, x, y, html, authorId, createdAt }) => ({
      id,
      x: Number(x),
      y: Number(y),
      html,
      authorId,
      createdAt,
    })),
  };
}

@Injectable()
export class PrismaApprovalRepository implements ApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByDocument(docType: ProjectDocType, docId: string): Promise<ApprovalRecord[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { docType, docId },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async listPendingFor(userId: string): Promise<ApprovalRecord[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { situation: 'OPEN', approverIds: { has: userId }, votes: { none: { userId } } },
      include,
      orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 50,
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<ApprovalRecord | null> {
    const row = await this.prisma.approvalRequest.findUnique({ where: { id }, include });
    return row ? toRecord(row) : null;
  }

  async hasOpenForFile(fileId: string): Promise<boolean> {
    return (await this.prisma.approvalRequest.count({ where: { fileId, situation: 'OPEN' } })) > 0;
  }

  async create(data: NewApproval): Promise<ApprovalRecord> {
    return toRecord(await this.prisma.approvalRequest.create({ data, include }));
  }

  async vote(id: string, vote: Omit<ApprovalVoteRecord, 'createdAt'>, situation: ApprovalSituation): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.approvalVote.create({ data: { requestId: id, ...vote } }),
      this.prisma.approvalRequest.update({ where: { id }, data: { situation } }),
    ]);
  }

  async setSituation(id: string, situation: ApprovalSituation): Promise<void> {
    await this.prisma.approvalRequest.update({ where: { id }, data: { situation } });
  }

  async addMarker(id: string, marker: Omit<ApprovalMarkerRecord, 'id' | 'createdAt'>): Promise<void> {
    await this.prisma.approvalMarker.create({ data: { requestId: id, ...marker } });
  }

  async deleteMarker(markerId: string): Promise<void> {
    await this.prisma.approvalMarker.delete({ where: { id: markerId } });
  }
}
