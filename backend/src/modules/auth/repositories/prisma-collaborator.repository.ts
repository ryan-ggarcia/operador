import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  CollaboratorData,
  CollaboratorFilter,
  CollaboratorRecord,
  CollaboratorRepository,
  PositionRecord,
} from './collaborator.repository.js';

const COLLABORATOR_INCLUDE = {
  position: { select: { name: true } },
  user: { select: { id: true } },
} satisfies Prisma.CollaboratorInclude;

type CollaboratorRow = Prisma.CollaboratorGetPayload<{
  include: typeof COLLABORATOR_INCLUDE;
}>;

const toNumber = (value: Prisma.Decimal | null) => (value == null ? null : value.toNumber());

function toRecord(row: CollaboratorRow): CollaboratorRecord {
  return {
    id: row.id,
    personType: row.personType,
    name: row.name,
    document: row.document,
    legalName: row.legalName,
    rg: row.rg,
    birthDate: row.birthDate,
    phone: row.phone,
    email: row.email,
    address: (row.address as Record<string, unknown> | null) ?? null,
    positionId: row.positionId,
    positionName: row.position?.name ?? null,
    admissionDate: row.admissionDate,
    dismissalDate: row.dismissalDate,
    grossSalary: toNumber(row.grossSalary),
    totalCost: toNumber(row.totalCost),
    hourlyRate: toNumber(row.hourlyRate),
    benefits: row.benefits,
    bankData: row.bankData,
    pixKeys: row.pixKeys,
    cvUrl: row.cvUrl,
    notes: row.notes,
    userId: row.user?.id ?? null,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function jsonField(value: unknown) {
  if (value === undefined) return undefined;
  return value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function toWriteData(data: Partial<CollaboratorData>) {
  const { address, benefits, bankData, pixKeys, ...rest } = data;
  return {
    ...rest,
    address: jsonField(address),
    benefits: jsonField(benefits),
    bankData: jsonField(bankData),
    pixKeys: jsonField(pixKeys),
  };
}

@Injectable()
export class PrismaCollaboratorRepository implements CollaboratorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: CollaboratorFilter): Promise<CollaboratorRecord[]> {
    const rows = await this.prisma.collaborator.findMany({
      where: {
        active: filter.active,
        positionId: filter.positionId,
        OR: filter.search
          ? [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
              { document: { contains: filter.search } },
            ]
          : undefined,
      },
      include: COLLABORATOR_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<CollaboratorRecord | null> {
    const row = await this.prisma.collaborator.findUnique({
      where: { id },
      include: COLLABORATOR_INCLUDE,
    });
    return row ? toRecord(row) : null;
  }

  async documentInUse(document: string, exceptId?: string): Promise<boolean> {
    const count = await this.prisma.collaborator.count({
      where: { document, id: exceptId ? { not: exceptId } : undefined },
    });
    return count > 0;
  }

  async create(data: CollaboratorData, actorId: string): Promise<CollaboratorRecord> {
    const row = await this.prisma.collaborator.create({
      data: {
        ...toWriteData(data),
        createdById: actorId,
        updatedById: actorId,
      } as Prisma.CollaboratorUncheckedCreateInput,
      include: COLLABORATOR_INCLUDE,
    });
    return toRecord(row);
  }

  async update(
    id: string,
    data: Partial<CollaboratorData> & { active?: boolean },
    actorId: string,
  ): Promise<CollaboratorRecord> {
    const row = await this.prisma.collaborator.update({
      where: { id },
      data: {
        ...toWriteData(data),
        updatedById: actorId,
      } as Prisma.CollaboratorUncheckedUpdateInput,
      include: COLLABORATOR_INCLUDE,
    });
    return toRecord(row);
  }

  listPositions(): Promise<PositionRecord[]> {
    return this.prisma.position.findMany({ orderBy: { name: 'asc' } });
  }

  findPosition(id: string): Promise<PositionRecord | null> {
    return this.prisma.position.findUnique({ where: { id } });
  }

  async positionNameInUse(name: string, exceptId?: string): Promise<boolean> {
    const count = await this.prisma.position.count({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
    });
    return count > 0;
  }

  createPosition(name: string): Promise<PositionRecord> {
    return this.prisma.position.create({ data: { name } });
  }

  updatePosition(
    id: string,
    changes: { name?: string; active?: boolean },
  ): Promise<PositionRecord> {
    return this.prisma.position.update({ where: { id }, data: changes });
  }
}
