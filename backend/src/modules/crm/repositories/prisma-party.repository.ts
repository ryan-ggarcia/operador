import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { FieldChange } from '../../../shared/history/diff.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { PartyRole } from '../public/crm.facade.js';
import type {
  PartyData,
  PartyDetail,
  PartyFilter,
  PartyListItem,
  PartyRecord,
  PartyRepository,
} from './party.repository.js';

const SUMMARY = {
  id: true,
  name: true,
  document: true,
  isClient: true,
  isSupplier: true,
  isProvider: true,
  isVehicle: true,
  active: true,
} as const;

const ROLE_FIELD: Record<PartyRole, keyof Prisma.PartyWhereInput> = {
  client: 'isClient',
  supplier: 'isSupplier',
  provider: 'isProvider',
  vehicle: 'isVehicle',
};

const DETAIL_INCLUDE = {
  clientGroup: { select: { name: true } },
} satisfies Prisma.PartyInclude;

type DetailRow = Prisma.PartyGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function toDetail({ clientGroup, createdById, updatedById, ...row }: DetailRow): PartyDetail {
  void createdById;
  void updatedById;
  return { ...row, clientGroupName: clientGroup?.name ?? null };
}

function toWriteData(data: Partial<PartyData>) {
  const { bankData, ...rest } = data;
  return {
    ...rest,
    bankData:
      bankData === undefined
        ? undefined
        : bankData === null
          ? Prisma.DbNull
          : (bankData as Prisma.InputJsonValue),
  };
}

@Injectable()
export class PrismaPartyRepository implements PartyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIds(ids: string[]): Promise<PartyRecord[]> {
    return this.prisma.party.findMany({
      where: { id: { in: ids } },
      select: SUMMARY,
    });
  }

  async search(filter: PartyFilter): Promise<Page<PartyListItem>> {
    const where: Prisma.PartyWhereInput = {
      active: filter.active,
      clientGroupId: filter.clientGroupId,
      AND: [
        { OR: filter.roles.map((role) => ({ [ROLE_FIELD[role]]: true })) },
        filter.search
          ? {
              OR: [
                { name: { contains: filter.search, mode: 'insensitive' } },
                { legalName: { contains: filter.search, mode: 'insensitive' } },
                { email: { contains: filter.search, mode: 'insensitive' } },
                { document: { contains: filter.search.replace(/\D/g, '') || filter.search } },
              ],
            }
          : {},
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.party.findMany({
        where,
        select: {
          ...SUMMARY,
          personType: true,
          legalName: true,
          email: true,
          phone1: true,
          city: true,
          state: true,
          clientGroupId: true,
          clientGroup: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.party.count({ where }),
    ]);
    return {
      items: rows.map(({ clientGroup, ...row }) => ({
        ...row,
        clientGroupName: clientGroup?.name ?? null,
      })),
      total,
    };
  }

  async findDetail(id: string): Promise<PartyDetail | null> {
    const row = await this.prisma.party.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    return row ? toDetail(row) : null;
  }

  findByDocument(document: string): Promise<PartyRecord | null> {
    return this.prisma.party.findUnique({ where: { document }, select: SUMMARY });
  }

  async clientGroupExists(id: string): Promise<boolean> {
    return (await this.prisma.clientGroup.count({ where: { id } })) > 0;
  }

  async create(data: PartyData, actorId: string): Promise<PartyDetail> {
    const row = await this.prisma.party.create({
      data: {
        ...toWriteData(data),
        createdById: actorId,
        updatedById: actorId,
      } as Prisma.PartyUncheckedCreateInput,
      include: DETAIL_INCLUDE,
    });
    return toDetail(row);
  }

  async update(
    id: string,
    data: Partial<PartyData> & { active?: boolean },
    actorId: string,
    changes: FieldChange[],
  ): Promise<PartyDetail> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (changes.length > 0) {
        await tx.crmHistory.createMany({
          data: changes.map((change) => ({
            entityType: 'party',
            entityId: id,
            userId: actorId,
            action: 'update',
            ...change,
          })),
        });
      }
      return tx.party.update({
        where: { id },
        data: { ...toWriteData(data), updatedById: actorId } as Prisma.PartyUncheckedUpdateInput,
        include: DETAIL_INCLUDE,
      });
    });
    return toDetail(row);
  }
}
