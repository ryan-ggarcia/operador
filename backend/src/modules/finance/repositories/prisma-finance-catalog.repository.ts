import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  AccountRecord,
  CatalogTable,
  CategoryRecord,
  FinanceCatalogRepository,
  NamedRecord,
} from './finance.repository.js';

function toAccount(row: Prisma.AccountGetPayload<object>): AccountRecord {
  return { ...row, initialBalance: row.initialBalance.toNumber() };
}

@Injectable()
export class PrismaFinanceCatalogRepository implements FinanceCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(): Promise<CategoryRecord[]> {
    return this.prisma.category.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  }

  findCategory(id: string): Promise<CategoryRecord | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  saveCategory(id: string | null, data: Omit<CategoryRecord, 'id'>): Promise<CategoryRecord> {
    return id ? this.prisma.category.update({ where: { id }, data }) : this.prisma.category.create({ data });
  }

  async categoryInUse(id: string): Promise<boolean> {
    return (await this.prisma.bill.count({ where: { categoryId: id } })) > 0;
  }

  async listAccounts(): Promise<AccountRecord[]> {
    const rows = await this.prisma.account.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
    return rows.map(toAccount);
  }

  async findAccount(id: string): Promise<AccountRecord | null> {
    const row = await this.prisma.account.findUnique({ where: { id } });
    return row ? toAccount(row) : null;
  }

  async saveAccount(id: string | null, data: Omit<AccountRecord, 'id' | 'isDefault'>): Promise<AccountRecord> {
    const row = id
      ? await this.prisma.account.update({ where: { id }, data })
      : await this.prisma.account.create({ data });
    return toAccount(row);
  }

  async makeDefaultAccount(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.account.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.account.update({ where: { id }, data: { isDefault: true } }),
    ]);
  }

  private delegate(table: CatalogTable) {
    return (table === 'paymentMethod'
      ? this.prisma.paymentMethod
      : this.prisma.costCenter) as unknown as Prisma.PaymentMethodDelegate;
  }

  listNamed(table: CatalogTable): Promise<NamedRecord[]> {
    return this.delegate(table).findMany({ orderBy: { name: 'asc' } });
  }

  findNamed(table: CatalogTable, id: string): Promise<NamedRecord | null> {
    return this.delegate(table).findUnique({ where: { id } });
  }

  saveNamed(table: CatalogTable, id: string | null, data: { name: string; active: boolean }): Promise<NamedRecord> {
    return id ? this.delegate(table).update({ where: { id }, data }) : this.delegate(table).create({ data });
  }

  listStatuses() {
    return this.prisma.financeStatus.findMany({ orderBy: { name: 'asc' } });
  }

  findStatus(id: string) {
    return this.prisma.financeStatus.findUnique({ where: { id }, select: { id: true } });
  }
}
