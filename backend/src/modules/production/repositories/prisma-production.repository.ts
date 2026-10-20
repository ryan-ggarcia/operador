import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import type { FieldChange } from '../../../shared/history/diff.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type {
  ItemData,
  ItemRecord,
  NewProduction,
  OrderData,
  OrderRecord,
  OrderTotalsData,
  PredefinedTextKind,
  PredefinedTextRecord,
  ProductionCatalogRepository,
  ProductionDetail,
  ProductionFilter,
  ProductionHeader,
  ProductionRecord,
  ProductionRepository,
  ProductionSituation,
  StatusRecord,
  TaxRecord,
} from './production.repository.js';

const num = (value: Prisma.Decimal | null | undefined) => (value == null ? 0 : value.toNumber());

const PRODUCTION_INCLUDE = {
  members: { select: { userId: true } },
  status: { select: { ignoresDelay: true } },
  orders: { select: { sentToFinanceAt: true } },
} satisfies Prisma.ProductionInclude;

type ProductionRow = Prisma.ProductionGetPayload<{ include: typeof PRODUCTION_INCLUDE }>;

function toRecord(row: ProductionRow): ProductionRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    sequence: row.sequence,
    clientId: row.clientId,
    clientContactId: row.clientContactId,
    title: row.title,
    responsibleId: row.responsibleId,
    requesterId: row.requesterId,
    statusId: row.statusId,
    statusIgnoresDelay: row.status?.ignoresDelay ?? false,
    situation: row.situation,
    deadline: row.deadline,
    validityDays: row.validityDays,
    taxId: row.taxId,
    taxPercent: num(row.taxPercent),
    paymentConditions: row.paymentConditions,
    clientNotes: row.clientNotes,
    briefing: row.briefing,
    totalValue: num(row.totalValue),
    commissionTotal: num(row.commissionTotal),
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    memberIds: row.members.map((member) => member.userId),
    sentToFinance: row.orders.some((order) => order.sentToFinanceAt !== null),
  };
}

const ITEM_INCLUDE = {
  suppliers: {
    include: { quotes: { orderBy: { quantity: 'asc' } } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ProductionItemInclude;

type ItemRow = Prisma.ProductionItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

function toItem(row: ItemRow): ItemRecord {
  return {
    id: row.id,
    sequence: row.sequence,
    title: row.title,
    description: row.description,
    quantities: row.quantities.map(num),
    commissionType: row.commissionType,
    commissionValue: num(row.commissionValue),
    feeType: row.feeType,
    feeValue: num(row.feeValue),
    suppliers: row.suppliers
      .filter((supplier) => supplier.active)
      .map((supplier) => ({
        id: supplier.id,
        supplierId: supplier.supplierId,
        estimateNumber: supplier.estimateNumber,
        dueDate: supplier.dueDate,
        orderGroup: supplier.orderGroup,
        quotes: supplier.quotes.map((quote) => ({
          id: quote.id,
          quantity: num(quote.quantity),
          unitValue: num(quote.unitValue),
          totalValue: num(quote.totalValue),
          commissionValue: num(quote.commissionValue),
          feeValue: num(quote.feeValue),
          approved: quote.approved,
        })),
      })),
  };
}

type OrderRow = Prisma.PurchaseOrderGetPayload<object>;

function toOrder(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    supplierId: row.supplierId,
    orderGroup: row.orderGroup,
    billingType: row.billingType,
    discount: num(row.discount),
    negotiatedCommission: row.negotiatedCommission == null ? null : num(row.negotiatedCommission),
    supplierNotes: row.supplierNotes,
    deliveryPlace: row.deliveryPlace,
    deliveryDate: row.deliveryDate,
    firstDueDate: row.firstDueDate,
    subtotal: num(row.subtotal),
    total: num(row.total),
    commission: num(row.commission),
    fee: num(row.fee),
    tax: num(row.tax),
    netValue: num(row.netValue),
    valueToPass: num(row.valueToPass),
    approvedById: row.approvedById,
    approvedAt: row.approvedAt,
    sentToFinanceAt: row.sentToFinanceAt,
  };
}

function history(id: string, actorId: string, action: string, changes: FieldChange[]) {
  return changes.map((change) => ({ entityType: 'production', entityId: id, userId: actorId, action, ...change }));
}

@Injectable()
export class PrismaProductionRepository implements ProductionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: ProductionFilter): Promise<Page<ProductionRecord>> {
    const and: Prisma.ProductionWhereInput[] = [];
    const involved: Prisma.ProductionWhereInput = {
      OR: [
        { responsibleId: filter.visibility.userId },
        { requesterId: filter.visibility.userId },
        { members: { some: { userId: filter.visibility.userId } } },
      ],
    };
    if (!filter.visibility.readAll || filter.mine) and.push(involved);
    if (filter.search) and.push({ title: { contains: filter.search, mode: 'insensitive' } });
    if (filter.supplierId) {
      and.push({ items: { some: { suppliers: { some: { supplierId: filter.supplierId, active: true } } } } });
    }
    const where: Prisma.ProductionWhereInput = {
      AND: and,
      situation: filter.situations?.length ? { in: filter.situations } : undefined,
      clientId: filter.clientId,
      projectId: filter.projectId,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.production.findMany({
        where,
        include: PRODUCTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.production.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  }

  async findById(id: string): Promise<ProductionDetail | null> {
    const row = await this.prisma.production.findUnique({
      where: { id },
      include: {
        ...PRODUCTION_INCLUDE,
        items: { where: { active: true }, include: ITEM_INCLUDE, orderBy: { sequence: 'asc' } },
        orders: { orderBy: [{ supplierId: 'asc' }, { orderGroup: 'asc' }] },
      },
    });
    if (!row) return null;
    return { ...toRecord(row), items: row.items.map(toItem), orders: row.orders.map(toOrder) };
  }

  async create(data: NewProduction, actorId: string): Promise<ProductionRecord> {
    const members = [...new Set([data.requesterId, data.responsibleId].filter(Boolean))] as string[];
    const row = await this.prisma.production.create({
      data: {
        ...data,
        createdById: actorId,
        updatedById: actorId,
        members: { create: members.map((userId) => ({ userId })) },
      },
      include: PRODUCTION_INCLUDE,
    });
    return toRecord(row);
  }

  async updateHeader(id: string, changes: Partial<ProductionHeader>, actorId: string, changesLog: FieldChange[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (changesLog.length) await tx.productionHistory.createMany({ data: history(id, actorId, 'update', changesLog) });
      if (changes.responsibleId) {
        await tx.productionMember.createMany({ data: [{ productionId: id, userId: changes.responsibleId }], skipDuplicates: true });
      }
      await tx.production.update({ where: { id }, data: { ...changes, updatedById: actorId } });
    });
  }

  async saveTotals(id: string, totals: { totalValue: number; commissionTotal: number }): Promise<void> {
    await this.prisma.production.update({ where: { id }, data: totals });
  }

  async changeSituation(id: string, situation: ProductionSituation, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.production.findUniqueOrThrow({ where: { id }, select: { situation: true } });
      await tx.productionHistory.create({
        data: { entityType: 'production', entityId: id, userId: actorId, action: 'situation', field: 'situation', oldValue: before.situation, newValue: situation },
      });
      await tx.production.update({
        where: { id },
        data: { situation, closedAt: situation === 'OPEN' ? null : new Date(), updatedById: actorId },
      });
    });
  }

  async closeByProject(projectId: string, situation: 'DONE' | 'CANCELED', actorId: string): Promise<number> {
    const result = await this.prisma.production.updateMany({
      where: { projectId, situation: situation === 'DONE' ? 'OPEN' : { not: 'CANCELED' } },
      data: { situation, closedAt: new Date(), updatedById: actorId },
    });
    return result.count;
  }

  async addMembers(id: string, userIds: string[]): Promise<void> {
    await this.prisma.productionMember.createMany({ data: userIds.map((userId) => ({ productionId: id, userId })), skipDuplicates: true });
  }

  async removeMember(id: string, userId: string): Promise<void> {
    await this.prisma.productionMember.deleteMany({ where: { productionId: id, userId } });
  }

  listHistory(id: string) {
    return this.prisma.productionHistory.findMany({
      where: { entityType: 'production', entityId: id },
      orderBy: { createdAt: 'desc' },
      omit: { entityType: true, entityId: true },
    });
  }

  async createItem(productionId: string, data: ItemData): Promise<ItemRecord> {
    const last = await this.prisma.productionItem.aggregate({ where: { productionId }, _max: { sequence: true } });
    const row = await this.prisma.productionItem.create({
      data: { ...data, productionId, sequence: (last._max.sequence ?? 0) + 1 },
      include: ITEM_INCLUDE,
    });
    return toItem(row);
  }

  async updateItem(id: string, data: ItemData): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const keep = data.quantities.map((quantity) => new Prisma.Decimal(quantity));
      await tx.quote.deleteMany({ where: { itemSupplier: { itemId: id }, quantity: { notIn: keep } } });
      await tx.productionItem.update({ where: { id }, data });
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.prisma.productionItem.delete({ where: { id } });
  }

  async addSupplier(itemId: string, data: { supplierId: string; estimateNumber: string | null; dueDate: Date | null; orderGroup: number }): Promise<void> {
    await this.prisma.itemSupplier.upsert({
      where: { itemId_supplierId: { itemId, supplierId: data.supplierId } },
      update: { ...data, active: true },
      create: { ...data, itemId },
    });
  }

  async updateSupplier(id: string, data: { estimateNumber?: string | null; dueDate?: Date | null; orderGroup?: number }): Promise<void> {
    await this.prisma.itemSupplier.update({ where: { id }, data });
  }

  async removeSupplier(id: string): Promise<void> {
    await this.prisma.itemSupplier.delete({ where: { id } });
  }

  async saveQuote(
    itemSupplierId: string,
    quantity: number,
    values: { unitValue: number; totalValue: number; commissionValue: number; feeValue: number },
  ): Promise<void> {
    await this.prisma.quote.upsert({
      where: { itemSupplierId_quantity: { itemSupplierId, quantity: new Prisma.Decimal(quantity) } },
      update: values,
      create: { ...values, itemSupplierId, quantity },
    });
  }

  async updateQuoteValues(values: { id: string; commissionValue: number; feeValue: number }[]): Promise<void> {
    await this.prisma.$transaction(
      values.map(({ id, ...data }) => this.prisma.quote.update({ where: { id }, data })),
    );
  }

  async setApproved(itemSupplierId: string, quantity: number | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.quote.updateMany({ where: { itemSupplierId, approved: true }, data: { approved: false } });
      if (quantity !== null) {
        await tx.quote.update({
          where: { itemSupplierId_quantity: { itemSupplierId, quantity: new Prisma.Decimal(quantity) } },
          data: { approved: true },
        });
      }
    });
  }

  async syncOrders(productionId: string, keys: { supplierId: string; orderGroup: number }[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findMany({ where: { productionId } });
      const wanted = new Set(keys.map((key) => `${key.supplierId}:${key.orderGroup}`));
      const stale = existing.filter(
        (order) => !wanted.has(`${order.supplierId}:${order.orderGroup}`) && order.sentToFinanceAt === null,
      );
      if (stale.length) await tx.purchaseOrder.deleteMany({ where: { id: { in: stale.map((order) => order.id) } } });
      const have = new Set(existing.map((order) => `${order.supplierId}:${order.orderGroup}`));
      const missing = keys.filter((key) => !have.has(`${key.supplierId}:${key.orderGroup}`));
      if (missing.length) await tx.purchaseOrder.createMany({ data: missing.map((key) => ({ ...key, productionId })) });
    });
  }

  async updateOrder(id: string, data: Partial<OrderData>): Promise<void> {
    await this.prisma.purchaseOrder.update({ where: { id }, data });
  }

  async saveOrderTotals(id: string, totals: OrderTotalsData): Promise<void> {
    await this.prisma.purchaseOrder.update({ where: { id }, data: totals });
  }

  async setOrderSent(id: string, at: Date | null, snapshot: unknown, actorId: string): Promise<void> {
    const order = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id }, select: { productionId: true } });
    await this.prisma.$transaction([
      this.prisma.productionHistory.create({
        data: {
          entityType: 'production',
          entityId: order.productionId,
          userId: actorId,
          action: at ? 'order-sent-to-finance' : 'order-billing-reopened',
          field: 'purchaseOrder',
          newValue: id,
        },
      }),
      this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          sentToFinanceAt: at,
          approvedById: at ? actorId : null,
          approvedAt: at,
          snapshot: snapshot == null ? Prisma.DbNull : (snapshot as Prisma.InputJsonValue),
        },
      }),
    ]);
  }
}

function toTax(row: Prisma.TaxGetPayload<object>): TaxRecord {
  return { ...row, percent: num(row.percent) };
}

@Injectable()
export class PrismaProductionCatalogRepository implements ProductionCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listTaxes(): Promise<TaxRecord[]> {
    return (await this.prisma.tax.findMany({ orderBy: [{ isDefault: 'desc' }, { title: 'asc' }] })).map(toTax);
  }

  async findTax(id: string): Promise<TaxRecord | null> {
    const row = await this.prisma.tax.findUnique({ where: { id } });
    return row ? toTax(row) : null;
  }

  async findDefaultTax(): Promise<TaxRecord | null> {
    const row = await this.prisma.tax.findFirst({ where: { isDefault: true, active: true } });
    return row ? toTax(row) : null;
  }

  async saveTax(id: string | null, data: Omit<TaxRecord, 'id' | 'isDefault'>): Promise<TaxRecord> {
    const row = id ? await this.prisma.tax.update({ where: { id }, data }) : await this.prisma.tax.create({ data });
    return toTax(row);
  }

  async makeDefaultTax(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.tax.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.tax.update({ where: { id }, data: { isDefault: true } }),
    ]);
  }

  listStatuses(includeInactive: boolean): Promise<StatusRecord[]> {
    return this.prisma.productionStatus.findMany({
      where: { active: includeInactive ? undefined : true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  findStatus(id: string): Promise<StatusRecord | null> {
    return this.prisma.productionStatus.findUnique({ where: { id } });
  }

  listTexts(kind?: PredefinedTextKind): Promise<PredefinedTextRecord[]> {
    return this.prisma.predefinedText.findMany({ where: { kind }, orderBy: { title: 'asc' } });
  }

  saveText(id: string | null, data: Omit<PredefinedTextRecord, 'id'>): Promise<PredefinedTextRecord> {
    return id ? this.prisma.predefinedText.update({ where: { id }, data }) : this.prisma.predefinedText.create({ data });
  }
}
