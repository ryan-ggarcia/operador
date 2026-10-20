import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  CatalogItem,
  CatalogKind,
  CatalogRepository,
  ContactData,
  ContactRecord,
  ContactRepository,
  PartyNoteRecord,
  PartyNoteRepository,
} from './contact.repository.js';

const CONTACT_INCLUDE = {
  department: { select: { name: true } },
} satisfies Prisma.ContactInclude;

type ContactRow = Prisma.ContactGetPayload<{ include: typeof CONTACT_INCLUDE }>;

function toContact({ department, createdAt, updatedAt, ...row }: ContactRow): ContactRecord {
  void createdAt;
  void updatedAt;
  return { ...row, departmentName: department?.name ?? null };
}

@Injectable()
export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByParty(partyId: string, includeInactive: boolean): Promise<ContactRecord[]> {
    const rows = await this.prisma.contact.findMany({
      where: { partyId, active: includeInactive ? undefined : true },
      include: CONTACT_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return rows.map(toContact);
  }

  async findByIds(ids: string[]): Promise<ContactRecord[]> {
    const rows = await this.prisma.contact.findMany({
      where: { id: { in: ids } },
      include: CONTACT_INCLUDE,
    });
    return rows.map(toContact);
  }

  async create(partyId: string, data: ContactData): Promise<ContactRecord> {
    const row = await this.prisma.contact.create({
      data: { ...data, partyId },
      include: CONTACT_INCLUDE,
    });
    return toContact(row);
  }

  async update(
    id: string,
    data: Partial<ContactData> & { active?: boolean },
  ): Promise<ContactRecord> {
    const row = await this.prisma.contact.update({
      where: { id },
      data,
      include: CONTACT_INCLUDE,
    });
    return toContact(row);
  }
}

@Injectable()
export class PrismaPartyNoteRepository implements PartyNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(partyId: string): Promise<PartyNoteRecord[]> {
    return this.prisma.partyNote.findMany({
      where: { partyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<PartyNoteRecord | null> {
    return this.prisma.partyNote.findUnique({ where: { id } });
  }

  create(partyId: string, authorId: string, html: string): Promise<PartyNoteRecord> {
    return this.prisma.partyNote.create({ data: { partyId, authorId, html } });
  }

  update(id: string, html: string): Promise<PartyNoteRecord> {
    return this.prisma.partyNote.update({ where: { id }, data: { html } });
  }
}

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Os dois cadastros têm o mesmo formato (id, name, active). */
  private delegate(kind: CatalogKind) {
    return (kind === 'clientGroup'
      ? this.prisma.clientGroup
      : this.prisma.department) as unknown as Prisma.ClientGroupDelegate;
  }

  list(kind: CatalogKind): Promise<CatalogItem[]> {
    return this.delegate(kind).findMany({ orderBy: { name: 'asc' } });
  }

  async exists(kind: CatalogKind, id: string): Promise<boolean> {
    return (await this.delegate(kind).count({ where: { id } })) > 0;
  }

  async nameInUse(kind: CatalogKind, name: string, exceptId?: string): Promise<boolean> {
    const count = await this.delegate(kind).count({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
    });
    return count > 0;
  }

  create(kind: CatalogKind, name: string): Promise<CatalogItem> {
    return this.delegate(kind).create({ data: { name } });
  }

  update(
    kind: CatalogKind,
    id: string,
    changes: { name?: string; active?: boolean },
  ): Promise<CatalogItem> {
    return this.delegate(kind).update({ where: { id }, data: changes });
  }
}
