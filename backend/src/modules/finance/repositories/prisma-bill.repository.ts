import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { FieldChange } from '../../../shared/history/diff.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { BillSituation } from '../domain/bill-rules.js';
import type {
  BillData,
  BillFilter,
  BillRecord,
  BillRepository,
  BillTotals,
  NewBill,
  TransferRecord,
} from './finance.repository.js';

const BILL_INCLUDE = {
  category: { select: { name: true } },
  account: { select: { name: true } },
  paymentMethod: { select: { name: true } },
} satisfies Prisma.BillInclude;

type BillRow = Prisma.BillGetPayload<{ include: typeof BILL_INCLUDE }>;

const num = (value: Prisma.Decimal | null | undefined) => (value == null ? 0 : value.toNumber());

function toRecord(row: BillRow): BillRecord {
  const { category, account, paymentMethod, amount, additions, discounts, finalAmount, updatedById, ...rest } = row;
  void updatedById;
  return {
    ...rest,
    amount: num(amount),
    additions: num(additions),
    discounts: num(discounts),
    finalAmount: num(finalAmount),
    categoryName: category.name,
    accountName: account.name,
    paymentMethodName: paymentMethod.name,
  };
}

function toTransfer(row: Prisma.TransferGetPayload<object>): TransferRecord {
  return {
    id: row.id,
    title: row.title,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    date: row.date,
    amount: num(row.amount),
    scheduled: row.scheduled,
    createdById: row.createdById,
    createdAt: row.createdAt,
  };
}

/** Período: em aberto pelo vencimento; quitado pela data de pagamento. */
function periodWhere(from?: Date, to?: Date): Prisma.BillWhereInput {
  if (!from && !to) return {};
  const range = { gte: from, lt: to };
  return {
    OR: [
      { situation: { not: 'PAID' }, dueDate: range },
      { situation: 'PAID', paidAt: range },
    ],
  };
}

@Injectable()
export class PrismaBillRepository implements BillRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: BillFilter): Promise<Page<BillRecord> & { totals: BillTotals }> {
    const and: Prisma.BillWhereInput[] = [periodWhere(filter.from, filter.to)];
    if (filter.search) {
      and.push({
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { documentNumber: { contains: filter.search, mode: 'insensitive' } },
          { referenceNumber: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filter.overdueAt) and.push({ situation: 'OPEN', dueDate: { lt: filter.overdueAt } });
    const where: Prisma.BillWhereInput = {
      AND: and,
      createdById: filter.createdById,
      kind: filter.kinds?.length ? { in: filter.kinds } : undefined,
      situation: filter.situations?.length ? { in: filter.situations } : undefined,
      partyId: filter.partyId,
      clientId: filter.clientId,
      projectId: filter.projectId,
      accountId: filter.accountId,
      categoryId: filter.categoryId,
      sourceType: filter.sourceType,
      sourceId: filter.sourceId,
    };
    const [rows, total, sums] = await this.prisma.$transaction([
      this.prisma.bill.findMany({
        where,
        include: BILL_INCLUDE,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: filter.limit,
        skip: filter.offset,
      }),
      this.prisma.bill.count({ where }),
      this.prisma.bill.groupBy({
        by: ['kind'],
        where: { AND: [where, { situation: { not: 'CANCELED' } }] },
        orderBy: { kind: 'asc' },
        _sum: { finalAmount: true },
      }),
    ]);
    const totals = { revenue: 0, expense: 0 };
    for (const group of sums) {
      const value = num(group._sum?.finalAmount);
      if (group.kind === 'REVENUE') totals.revenue = value;
      else totals.expense = value;
    }
    return { items: rows.map(toRecord), total, totals };
  }

  async findById(id: string): Promise<BillRecord | null> {
    const row = await this.prisma.bill.findUnique({ where: { id }, include: BILL_INCLUDE });
    return row ? toRecord(row) : null;
  }

  async findByIds(ids: string[]): Promise<BillRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.bill.findMany({ where: { id: { in: ids } }, include: BILL_INCLUDE });
    return rows.map(toRecord);
  }

  async findGroup(groupId: string): Promise<BillRecord[]> {
    const rows = await this.prisma.bill.findMany({
      where: { installmentGroupId: groupId },
      include: BILL_INCLUDE,
      orderBy: { installmentNumber: 'asc' },
    });
    return rows.map(toRecord);
  }

  async createMany(bills: NewBill[], actorId: string): Promise<BillRecord[]> {
    const rows = await this.prisma.$transaction(
      bills.map((bill) =>
        this.prisma.bill.create({
          data: { ...bill, createdById: actorId, updatedById: actorId },
          include: BILL_INCLUDE,
        }),
      ),
    );
    return rows.map(toRecord);
  }

  async update(id: string, data: Partial<BillData>, actorId: string, history: FieldChange[]): Promise<BillRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      if (history.length) {
        await tx.financeHistory.createMany({
          data: history.map((change) => ({ entityType: 'bill', entityId: id, userId: actorId, action: 'update', ...change })),
        });
      }
      return tx.bill.update({ where: { id }, data: { ...data, updatedById: actorId }, include: BILL_INCLUDE });
    });
    return toRecord(row);
  }

  async setSituation(ids: string[], situation: BillSituation, paidAt: Date | null, actorId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.financeHistory.createMany({
        data: ids.map((id) => ({
          entityType: 'bill',
          entityId: id,
          userId: actorId,
          action: 'situation',
          field: 'situation',
          newValue: situation,
        })),
      }),
      this.prisma.bill.updateMany({
        where: { id: { in: ids } },
        data: { situation, paidAt, updatedById: actorId },
      }),
    ]);
  }

  countActiveByProject(projectId: string): Promise<number> {
    return this.prisma.bill.count({ where: { projectId, situation: { not: 'CANCELED' } } });
  }

  listHistory(id: string) {
    return this.prisma.financeHistory.findMany({
      where: { entityType: 'bill', entityId: id },
      orderBy: { createdAt: 'desc' },
      omit: { entityType: true, entityId: true },
    });
  }

  async summary(from: Date, to: Date, createdById?: string) {
    const base = { createdById, situation: { not: 'CANCELED' as const } };
    const [groups, overdue] = await Promise.all([
      this.prisma.bill.groupBy({
        by: ['kind', 'situation'],
        where: { ...base, ...periodWhere(from, to) },
        _sum: { finalAmount: true },
      }),
      this.prisma.bill.groupBy({
        by: ['kind'],
        where: { createdById, situation: 'OPEN', dueDate: { lt: from } },
        _sum: { finalAmount: true },
      }),
    ]);
    const pick = (kind: string, situation: string) =>
      num(groups.find((group) => group.kind === kind && group.situation === situation)?._sum.finalAmount);
    return {
      revenuePaid: pick('REVENUE', 'PAID'),
      revenueOpen: pick('REVENUE', 'OPEN'),
      expensePaid: pick('EXPENSE', 'PAID'),
      expenseOpen: pick('EXPENSE', 'OPEN'),
      overdueRevenue: num(overdue.find((group) => group.kind === 'REVENUE')?._sum.finalAmount),
      overdueExpense: num(overdue.find((group) => group.kind === 'EXPENSE')?._sum.finalAmount),
    };
  }

  async paidByAccount(until: Date) {
    const groups = await this.prisma.bill.groupBy({
      by: ['accountId', 'kind'],
      where: { situation: 'PAID', paidAt: { lt: until } },
      _sum: { finalAmount: true },
    });
    const result = new Map<string, { accountId: string; revenue: number; expense: number }>();
    for (const group of groups) {
      const entry = result.get(group.accountId) ?? { accountId: group.accountId, revenue: 0, expense: 0 };
      if (group.kind === 'REVENUE') entry.revenue += num(group._sum.finalAmount);
      else entry.expense += num(group._sum.finalAmount);
      result.set(group.accountId, entry);
    }
    return [...result.values()];
  }

  async listTransfers(from?: Date, to?: Date): Promise<TransferRecord[]> {
    const rows = await this.prisma.transfer.findMany({
      where: from || to ? { date: { gte: from, lt: to } } : undefined,
      orderBy: { date: 'desc' },
    });
    return rows.map(toTransfer);
  }

  async findTransfer(id: string): Promise<TransferRecord | null> {
    const row = await this.prisma.transfer.findUnique({ where: { id } });
    return row ? toTransfer(row) : null;
  }

  async createTransfer(
    data: Omit<TransferRecord, 'id' | 'createdAt' | 'createdById'>,
    actorId: string,
  ): Promise<TransferRecord> {
    return toTransfer(await this.prisma.transfer.create({ data: { ...data, createdById: actorId } }));
  }

  async deleteTransfer(id: string): Promise<void> {
    await this.prisma.transfer.delete({ where: { id } });
  }

  async transfersByAccount(until: Date) {
    const [outgoing, incoming] = await Promise.all([
      this.prisma.transfer.groupBy({ by: ['fromAccountId'], where: { date: { lt: until } }, _sum: { amount: true } }),
      this.prisma.transfer.groupBy({ by: ['toAccountId'], where: { date: { lt: until } }, _sum: { amount: true } }),
    ]);
    const result = new Map<string, { accountId: string; incoming: number; outgoing: number }>();
    const entry = (accountId: string) => {
      const item = result.get(accountId) ?? { accountId, incoming: 0, outgoing: 0 };
      result.set(accountId, item);
      return item;
    };
    for (const group of outgoing) entry(group.fromAccountId).outgoing += num(group._sum.amount);
    for (const group of incoming) entry(group.toAccountId).incoming += num(group._sum.amount);
    return [...result.values()];
  }
}
