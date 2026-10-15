import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { FieldChange } from '../../../shared/history/diff.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type {
  GridData,
  GridRecord,
  LineData,
  LineRecord,
  MediaDetail,
  MediaFilter,
  MediaHeader,
  MediaRecord,
  MediaRepository,
  MediaSituation,
  NewMedia,
  PieceRecord,
  SavedTotals,
} from './media.repository.js';

const num = (value: Prisma.Decimal | null): number => (value == null ? 0 : value.toNumber());

const MEDIA_INCLUDE = {
  members: { select: { userId: true } },
  status: { select: { ignoresDelay: true } },
} satisfies Prisma.MediaInclude;

type MediaRow = Prisma.MediaGetPayload<{ include: typeof MEDIA_INCLUDE }>;

function toRecord(row: MediaRow): MediaRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    sequence: row.sequence,
    clientId: row.clientId,
    title: row.title,
    mediaType: row.mediaType,
    vehicleId: row.vehicleId,
    vehicleContactId: row.vehicleContactId,
    networkId: row.networkId,
    channel: row.channel,
    target: row.target,
    estimateNumber: row.estimateNumber,
    responsibleId: row.responsibleId,
    requesterId: row.requesterId,
    statusId: row.statusId,
    statusIgnoresDelay: row.status?.ignoresDelay ?? false,
    situation: row.situation,
    deadline: row.deadline,
    documentDate: row.documentDate,
    commissionType: row.commissionType,
    commissionValue: num(row.commissionValue),
    negotiatedCommission: row.negotiatedCommission == null ? null : num(row.negotiatedCommission),
    feeType: row.feeType,
    feeValue: num(row.feeValue),
    discountType: row.discountType,
    discountValue: num(row.discountValue),
    grossTotal: num(row.grossTotal),
    bonusTotal: num(row.bonusTotal),
    netValue: num(row.netValue),
    billingType: row.billingType,
    firstDueDate: row.firstDueDate,
    paymentCondition: row.paymentCondition,
    vehicleNotes: row.vehicleNotes,
    clientNotes: row.clientNotes,
    briefing: row.briefing,
    sentToFinanceAt: row.sentToFinanceAt,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberIds: row.members.map((member) => member.userId),
  };
}

type LineRow = Prisma.MediaLineGetPayload<object>;

function toLine(row: LineRow): LineRecord {
  return {
    id: row.id,
    gridId: row.gridId,
    order: row.order,
    pieceId: row.pieceId,
    programId: row.programId,
    product: row.product,
    location: row.location,
    section: row.section,
    position: row.position,
    color: row.color,
    format: row.format,
    placementType: row.placementType,
    costMetricId: row.costMetricId,
    startDate: row.startDate,
    endDate: row.endDate,
    biweeks: (row.biweeks as number[] | null) ?? null,
    dailyInsertions: (row.dailyInsertions as Record<string, number> | null) ?? null,
    insertions: row.insertions,
    unitValue: num(row.unitValue),
    discountType: row.discountType,
    discountValue: num(row.discountValue),
    subtotal: num(row.subtotal),
    isBonus: row.isBonus,
  };
}

const GRID_INCLUDE = {
  market: { select: { name: true } },
  lines: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.MediaGridInclude;

type GridRow = Prisma.MediaGridGetPayload<{ include: typeof GRID_INCLUDE }>;

function toGrid(row: GridRow): GridRecord {
  return {
    id: row.id,
    marketId: row.marketId,
    marketName: row.market?.name ?? null,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    order: row.order,
    lines: row.lines.map(toLine),
  };
}

function lineWrite(data: LineData) {
  const { biweeks, dailyInsertions, ...rest } = data;
  return {
    ...rest,
    biweeks: biweeks ? (biweeks as Prisma.InputJsonValue) : Prisma.DbNull,
    dailyInsertions: dailyInsertions ? (dailyInsertions as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}

function involvedWhere(userId: string): Prisma.MediaWhereInput {
  return {
    OR: [{ responsibleId: userId }, { requesterId: userId }, { members: { some: { userId } } }],
  };
}

@Injectable()
export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: MediaFilter): Promise<Page<MediaRecord>> {
    const and: Prisma.MediaWhereInput[] = [];
    if (!filter.visibility.readAll || filter.mine) and.push(involvedWhere(filter.visibility.userId));
    if (filter.search) {
      and.push({
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { estimateNumber: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.MediaWhereInput = {
      AND: and,
      mediaType: filter.mediaTypes?.length ? { in: filter.mediaTypes } : undefined,
      situation: filter.situations?.length ? { in: filter.situations } : undefined,
      clientId: filter.clientId,
      vehicleId: filter.vehicleId,
      projectId: filter.projectId,
      statusId: filter.statusIds?.length ? { in: filter.statusIds } : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        where,
        include: MEDIA_INCLUDE,
        orderBy: [{ createdAt: 'desc' }],
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.media.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  async findById(id: string): Promise<MediaDetail | null> {
    const row = await this.prisma.media.findUnique({
      where: { id },
      include: {
        ...MEDIA_INCLUDE,
        pieces: { orderBy: { letter: 'asc' } },
        grids: { include: GRID_INCLUDE, orderBy: [{ order: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!row) return null;
    return {
      ...toRecord(row),
      pieces: row.pieces.map(({ id, letter, title }) => ({ id, letter, title })),
      grids: row.grids.map(toGrid),
    };
  }

  async create(data: NewMedia, actorId: string): Promise<MediaRecord> {
    const members = [...new Set([data.requesterId, data.responsibleId].filter(Boolean))] as string[];
    const row = await this.prisma.media.create({
      data: {
        ...data,
        createdById: actorId,
        updatedById: actorId,
        members: { create: members.map((userId) => ({ userId })) },
      },
      include: MEDIA_INCLUDE,
    });
    return toRecord(row);
  }

  async updateHeader(
    id: string,
    changes: Partial<MediaHeader>,
    actorId: string,
    history: FieldChange[],
    clearGrids: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (history.length) {
        await tx.mediaHistory.createMany({
          data: history.map((change) => ({ entityType: 'media', entityId: id, userId: actorId, action: 'update', ...change })),
        });
      }
      if (clearGrids) await tx.mediaGrid.deleteMany({ where: { mediaId: id } });
      if (changes.responsibleId) {
        await tx.mediaMember.createMany({ data: [{ mediaId: id, userId: changes.responsibleId }], skipDuplicates: true });
      }
      await tx.media.update({ where: { id }, data: { ...changes, updatedById: actorId } });
    });
  }

  async setSentToFinance(id: string, at: Date | null, snapshot: unknown, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.mediaHistory.create({
        data: {
          entityType: 'media',
          entityId: id,
          userId: actorId,
          action: at ? 'sent-to-finance' : 'billing-reopened',
        },
      }),
      this.prisma.media.update({
        where: { id },
        data: {
          sentToFinanceAt: at,
          snapshot: snapshot == null ? Prisma.DbNull : (snapshot as Prisma.InputJsonValue),
          updatedById: actorId,
        },
      }),
    ]);
  }

  async saveTotals(id: string, totals: SavedTotals): Promise<void> {
    await this.prisma.media.update({ where: { id }, data: totals });
  }

  async changeSituation(id: string, situation: MediaSituation, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.media.findUniqueOrThrow({ where: { id }, select: { situation: true } });
      await tx.mediaHistory.create({
        data: {
          entityType: 'media',
          entityId: id,
          userId: actorId,
          action: 'situation',
          field: 'situation',
          oldValue: before.situation,
          newValue: situation,
        },
      });
      await tx.media.update({
        where: { id },
        data: { situation, closedAt: situation === 'OPEN' ? null : new Date(), updatedById: actorId },
      });
    });
  }

  async closeByProject(projectId: string, situation: 'DONE' | 'CANCELED', actorId: string): Promise<number> {
    const result = await this.prisma.media.updateMany({
      where: { projectId, situation: situation === 'DONE' ? 'OPEN' : { not: 'CANCELED' } },
      data: { situation, closedAt: new Date(), updatedById: actorId },
    });
    return result.count;
  }

  async summarize(filter: { projectId?: string; clientId?: string }) {
    const groups = await this.prisma.media.groupBy({
      by: ['situation'],
      where: { projectId: filter.projectId, clientId: filter.clientId },
      _count: { _all: true },
      _sum: { grossTotal: true, netValue: true },
    });
    let count = 0;
    let open = 0;
    let grossTotal = 0;
    let netValue = 0;
    for (const group of groups) {
      count += group._count._all;
      if (group.situation === 'OPEN') open += group._count._all;
      if (group.situation !== 'CANCELED') {
        grossTotal += num(group._sum.grossTotal);
        netValue += num(group._sum.netValue);
      }
    }
    return { count, open, grossTotal, netValue };
  }

  async addMembers(id: string, userIds: string[]): Promise<void> {
    await this.prisma.mediaMember.createMany({
      data: userIds.map((userId) => ({ mediaId: id, userId })),
      skipDuplicates: true,
    });
  }

  async removeMember(id: string, userId: string): Promise<void> {
    await this.prisma.mediaMember.deleteMany({ where: { mediaId: id, userId } });
  }

  listHistory(id: string) {
    return this.prisma.mediaHistory.findMany({
      where: { entityType: 'media', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 500,
      omit: { entityType: true, entityId: true },
    });
  }

  async createPiece(mediaId: string, letter: string, title: string): Promise<PieceRecord> {
    const row = await this.prisma.mediaPiece.create({ data: { mediaId, letter, title } });
    return { id: row.id, letter: row.letter, title: row.title };
  }

  async updatePiece(id: string, title: string): Promise<PieceRecord> {
    const row = await this.prisma.mediaPiece.update({ where: { id }, data: { title } });
    return { id: row.id, letter: row.letter, title: row.title };
  }

  async deletePiece(id: string): Promise<void> {
    await this.prisma.mediaPiece.delete({ where: { id } });
  }

  async pieceInUse(id: string): Promise<boolean> {
    return (await this.prisma.mediaLine.count({ where: { pieceId: id } })) > 0;
  }

  async createGrid(mediaId: string, data: GridData): Promise<GridRecord> {
    const last = await this.prisma.mediaGrid.aggregate({ where: { mediaId }, _max: { order: true } });
    const row = await this.prisma.mediaGrid.create({
      data: { ...data, mediaId, order: (last._max.order ?? -1) + 1 },
      include: GRID_INCLUDE,
    });
    return toGrid(row);
  }

  async updateGrid(id: string, data: Partial<GridData>): Promise<void> {
    await this.prisma.mediaGrid.update({ where: { id }, data });
  }

  async deleteGrid(id: string): Promise<void> {
    await this.prisma.mediaGrid.delete({ where: { id } });
  }

  async duplicateGrid(id: string, data: GridData): Promise<GridRecord> {
    const source = await this.prisma.mediaGrid.findUniqueOrThrow({ where: { id }, include: GRID_INCLUDE });
    const created = await this.createGrid(source.mediaId, data);
    for (const line of source.lines.map(toLine)) {
      const { id: lineId, gridId, order, ...rest } = line;
      void lineId;
      void gridId;
      await this.prisma.mediaLine.create({ data: { ...lineWrite(rest), gridId: created.id, order } });
    }
    const row = await this.prisma.mediaGrid.findUniqueOrThrow({ where: { id: created.id }, include: GRID_INCLUDE });
    return toGrid(row);
  }

  async createLine(gridId: string, data: LineData): Promise<LineRecord> {
    const last = await this.prisma.mediaLine.aggregate({ where: { gridId }, _max: { order: true } });
    const row = await this.prisma.mediaLine.create({
      data: { ...lineWrite(data), gridId, order: (last._max.order ?? -1) + 1 },
    });
    return toLine(row);
  }

  async updateLine(id: string, data: LineData): Promise<LineRecord> {
    const row = await this.prisma.mediaLine.update({ where: { id }, data: lineWrite(data) });
    return toLine(row);
  }

  async deleteLine(id: string): Promise<void> {
    await this.prisma.mediaLine.delete({ where: { id } });
  }
}
