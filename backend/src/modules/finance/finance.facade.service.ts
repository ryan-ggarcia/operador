import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { fromCents, toCents } from '../../shared/money/money.js';
import { hasLevel, READ_ALL, type UserPermissions } from '../auth/public/index.js';
import { TreasuryService } from './bills/treasury.service.js';
import type {
  CashSummary,
  PeriodSummary,
  FinanceFacade,
  FinanceInvoiceClass,
  FinanceSourceType,
  SourceBill,
  SourceBillInput,
} from './public/finance.facade.js';
import {
  BILL_REPOSITORY,
  FINANCE_CATALOG_REPOSITORY,
  type BillRepository,
  type CategoryRecord,
  type FinanceCatalogRepository,
} from './repositories/finance.repository.js';

/**
 * Categoria de cada classe de fatura, pelos nomes do plano de contas do seed
 * (os da agência no Operand). Sem a categoria, usa a primeira ativa do tipo.
 */
const CATEGORY_NAME: Record<FinanceSourceType, Record<FinanceInvoiceClass, string>> = {
  MEDIA: {
    AGENCY_RECEIVES_COMMISSION_CLIENT: 'PI – Comissão',
    AGENCY_RECEIVES_COMMISSION_THIRD_PARTY: 'PI – Comissão',
    AGENCY_RECEIVES_NET_CLIENT: 'PI – Repasse',
    AGENCY_RECEIVES_TOTAL_CLIENT: 'PI – Repasse',
    AGENCY_PAYS_NET_THIRD_PARTY: 'PI – Veículos',
    AGENCY_PAYS_TOTAL_THIRD_PARTY: 'PI – Veículos',
    FEE: 'Honorário',
  },
  PRODUCTION: {
    AGENCY_RECEIVES_COMMISSION_CLIENT: 'PP – Comissão',
    AGENCY_RECEIVES_COMMISSION_THIRD_PARTY: 'PP – Comissão',
    AGENCY_RECEIVES_NET_CLIENT: 'PP – Repasse',
    AGENCY_RECEIVES_TOTAL_CLIENT: 'PP – Repasse',
    AGENCY_PAYS_NET_THIRD_PARTY: 'PP – Fornecedores',
    AGENCY_PAYS_TOTAL_THIRD_PARTY: 'PP – Fornecedores',
    FEE: 'Honorário',
  },
};

function pickCategory(categories: CategoryRecord[], kind: 'REVENUE' | 'EXPENSE', name: string): CategoryRecord | undefined {
  const active = categories.filter((category) => category.active && category.kind === kind);
  return active.find((category) => category.name.toLowerCase() === name.toLowerCase()) ?? active[0];
}

@Injectable()
export class FinanceFacadeService implements FinanceFacade {
  constructor(
    @Inject(BILL_REPOSITORY) private readonly bills: BillRepository,
    @Inject(FINANCE_CATALOG_REPOSITORY) private readonly catalog: FinanceCatalogRepository,
    private readonly treasury: TreasuryService,
  ) {}

  async getPeriodSummaryForUser(
    userId: string,
    access: UserPermissions,
    from: string,
    to: string,
  ): Promise<PeriodSummary> {
    // Mesma exigência do FinanceController (@RequireAccess('financial')).
    if (!hasLevel(access, 'financial', 1)) throw new ForbiddenException('Sem acesso ao financeiro.');
    const [summary, accounts] = await Promise.all([
      this.treasury.summary(userId, access, from, to),
      this.treasury.listAccounts(),
    ]);
    return {
      ...summary,
      onlyOwnBills: access.modules.financial < READ_ALL,
      accounts: accounts
        .filter((account) => account.active)
        .map((account) => ({ name: account.name, balance: account.balance })),
    };
  }

  async createBillsFromSource(
    sourceType: FinanceSourceType,
    sourceId: string,
    bills: SourceBillInput[],
    actorId: string,
  ): Promise<string[]> {
    const existing = await this.getBillsBySource(sourceType, sourceId);
    if (existing.some((bill) => bill.situation !== 'CANCELED')) {
      throw new BadRequestException('Este documento já tem faturas no financeiro.');
    }
    const [accounts, methods, categories] = await Promise.all([
      this.catalog.listAccounts(),
      this.catalog.listNamed('paymentMethod'),
      this.catalog.listCategories(),
    ]);
    const account = accounts.find((item) => item.isDefault && item.active) ?? accounts.find((item) => item.active);
    const method = methods.find((item) => item.isDefault && item.active) ?? methods.find((item) => item.active);
    if (!account || !method) {
      throw new BadRequestException('Cadastre uma conta e uma forma de pagamento no financeiro antes de enviar.');
    }
    const records = await this.bills.createMany(
      bills.map((bill) => {
        const category = pickCategory(categories, bill.kind, CATEGORY_NAME[sourceType][bill.invoiceClass]);
        if (!category) throw new BadRequestException('Cadastre categorias de receita e despesa no financeiro.');
        if (toCents(bill.amount) <= 0) throw new BadRequestException('Fatura com valor zero não é enviada.');
        return {
          kind: bill.kind,
          partyType: bill.partyType,
          partyId: bill.partyId,
          title: bill.title,
          categoryId: category.id,
          accountId: account.id,
          paymentMethodId: method.id,
          amount: bill.amount,
          additions: 0,
          discounts: 0,
          finalAmount: bill.amount,
          dueDate: new Date(`${bill.dueDate}T00:00:00.000Z`),
          competenceDate: null,
          billingDate: null,
          documentNumber: bill.documentNumber ?? null,
          referenceNumber: null,
          clientId: bill.clientId,
          projectId: bill.projectId,
          statusId: null,
          notes: null,
          installmentGroupId: null,
          installmentNumber: 1,
          installmentCount: 1,
          condition: 'SINGLE',
          sourceType,
          sourceId,
          invoiceClass: bill.invoiceClass,
          situation: 'OPEN',
          paidAt: null,
        };
      }),
      actorId,
    );
    return records.map((record) => record.id);
  }

  async getBillsBySource(sourceType: FinanceSourceType, sourceId: string): Promise<SourceBill[]> {
    const page = await this.bills.list({ sourceType, sourceId, limit: 200, offset: 0 });
    return page.items.map((bill) => ({
      id: bill.id,
      kind: bill.kind,
      invoiceClass: bill.invoiceClass,
      title: bill.title,
      amount: bill.finalAmount,
      dueDate: bill.dueDate,
      situation: bill.situation,
    }));
  }

  async reopenSource(sourceType: FinanceSourceType, sourceId: string, actorId: string): Promise<void> {
    const bills = (await this.getBillsBySource(sourceType, sourceId)).filter((bill) => bill.situation !== 'CANCELED');
    if (bills.some((bill) => bill.situation === 'PAID')) {
      throw new BadRequestException('Há fatura quitada: estorne no financeiro antes de reabrir o faturamento.');
    }
    if (bills.length) await this.bills.setSituation(bills.map((bill) => bill.id), 'CANCELED', null, actorId);
  }

  async getCashSummary(from: string, to: string): Promise<CashSummary> {
    const totals = await this.bills.summary(new Date(`${from}T00:00:00.000Z`), new Date(`${to}T00:00:00.000Z`));
    return {
      revenuePaid: totals.revenuePaid,
      revenueOpen: totals.revenueOpen,
      expensePaid: totals.expensePaid,
      expenseOpen: totals.expenseOpen,
      balance: fromCents(toCents(totals.revenuePaid) - toCents(totals.expensePaid)),
    };
  }
}
