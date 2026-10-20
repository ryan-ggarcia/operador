import type { FieldChange } from '../../../shared/history/diff.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { BillCondition, BillKind, BillSituation } from '../domain/bill-rules.js';

export const BILL_REPOSITORY = Symbol('BILL_REPOSITORY');
export const FINANCE_CATALOG_REPOSITORY = Symbol('FINANCE_CATALOG_REPOSITORY');

export type PartyType = 'CLIENT' | 'SUPPLIER' | 'PROVIDER' | 'VEHICLE' | 'COLLABORATOR';
export type SourceType = 'MANUAL' | 'MEDIA' | 'PRODUCTION' | 'PROJECT' | 'JOB' | 'TRANSFER';
export type InvoiceClass =
  | 'AGENCY_RECEIVES_COMMISSION_CLIENT'
  | 'AGENCY_RECEIVES_COMMISSION_THIRD_PARTY'
  | 'AGENCY_RECEIVES_NET_CLIENT'
  | 'AGENCY_RECEIVES_TOTAL_CLIENT'
  | 'AGENCY_PAYS_NET_THIRD_PARTY'
  | 'AGENCY_PAYS_TOTAL_THIRD_PARTY'
  | 'FEE';

/** Campos que se editam num lançamento. */
export interface BillData {
  partyType: PartyType;
  partyId: string;
  title: string;
  categoryId: string;
  accountId: string;
  paymentMethodId: string;
  amount: number;
  additions: number;
  discounts: number;
  finalAmount: number;
  dueDate: Date;
  competenceDate: Date | null;
  billingDate: Date | null;
  documentNumber: string | null;
  referenceNumber: string | null;
  clientId: string | null;
  projectId: string | null;
  statusId: string | null;
  notes: string | null;
}

export interface NewBill extends BillData {
  kind: BillKind;
  installmentGroupId: string | null;
  installmentNumber: number;
  installmentCount: number;
  condition: BillCondition;
  sourceType: SourceType;
  sourceId: string | null;
  invoiceClass: InvoiceClass | null;
  situation: BillSituation;
  paidAt: Date | null;
}

export interface BillRecord extends NewBill {
  id: string;
  categoryName: string;
  accountName: string;
  paymentMethodName: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillFilter {
  /** Nível 1: só os lançamentos criados pelo usuário. */
  createdById?: string;
  kinds?: BillKind[];
  situations?: BillSituation[];
  /** Vencimento (ou pagamento, se quitado) dentro do período. */
  from?: Date;
  to?: Date;
  search?: string;
  partyId?: string;
  clientId?: string;
  projectId?: string;
  accountId?: string;
  categoryId?: string;
  sourceType?: SourceType;
  sourceId?: string;
  overdueAt?: Date;
  limit: number;
  offset: number;
}

export interface BillTotals {
  revenue: number;
  expense: number;
}

export interface TransferRecord {
  id: string;
  title: string;
  fromAccountId: string;
  toAccountId: string;
  date: Date;
  amount: number;
  scheduled: boolean;
  createdById: string | null;
  createdAt: Date;
}

/** Lançamentos e transferências (schema "finance"). */
export interface BillRepository {
  list(filter: BillFilter): Promise<Page<BillRecord> & { totals: BillTotals }>;
  findById(id: string): Promise<BillRecord | null>;
  findByIds(ids: string[]): Promise<BillRecord[]>;
  findGroup(groupId: string): Promise<BillRecord[]>;
  /** Cria vários de uma vez (parcelas, faturas de um documento). */
  createMany(bills: NewBill[], actorId: string): Promise<BillRecord[]>;
  update(id: string, data: Partial<BillData>, actorId: string, history: FieldChange[]): Promise<BillRecord>;
  setSituation(ids: string[], situation: BillSituation, paidAt: Date | null, actorId: string): Promise<void>;
  /** Lançamentos não cancelados de um projeto. */
  countActiveByProject(projectId: string): Promise<number>;
  listHistory(id: string): Promise<
    { id: string; userId: string | null; action: string; field: string | null; oldValue: string | null; newValue: string | null; createdAt: Date }[]
  >;
  /** Somas para o resumo do período (quitados e em aberto). */
  summary(from: Date, to: Date, createdById?: string): Promise<{
    revenuePaid: number;
    revenueOpen: number;
    expensePaid: number;
    expenseOpen: number;
    overdueRevenue: number;
    overdueExpense: number;
  }>;
  /** Por conta: receitas e despesas quitadas até a data. */
  paidByAccount(until: Date): Promise<{ accountId: string; revenue: number; expense: number }[]>;

  listTransfers(from?: Date, to?: Date): Promise<TransferRecord[]>;
  findTransfer(id: string): Promise<TransferRecord | null>;
  createTransfer(data: Omit<TransferRecord, 'id' | 'createdAt' | 'createdById'>, actorId: string): Promise<TransferRecord>;
  deleteTransfer(id: string): Promise<void>;
  /** Por conta: entradas e saídas de transferências até a data. */
  transfersByAccount(until: Date): Promise<{ accountId: string; incoming: number; outgoing: number }[]>;
}

export interface CategoryRecord {
  id: string;
  name: string;
  parentId: string | null;
  kind: BillKind;
  active: boolean;
}

export interface AccountRecord {
  id: string;
  name: string;
  bank: string | null;
  accountType: string | null;
  agency: string | null;
  number: string | null;
  initialBalance: number;
  isDefault: boolean;
  active: boolean;
}

export interface NamedRecord {
  id: string;
  name: string;
  isDefault?: boolean;
  active: boolean;
}

export type CatalogTable = 'paymentMethod' | 'costCenter';

/** Plano de contas, contas bancárias, formas de pagamento, centros de custo e status. */
export interface FinanceCatalogRepository {
  listCategories(): Promise<CategoryRecord[]>;
  findCategory(id: string): Promise<CategoryRecord | null>;
  saveCategory(id: string | null, data: Omit<CategoryRecord, 'id'>): Promise<CategoryRecord>;
  categoryInUse(id: string): Promise<boolean>;

  listAccounts(): Promise<AccountRecord[]>;
  findAccount(id: string): Promise<AccountRecord | null>;
  saveAccount(id: string | null, data: Omit<AccountRecord, 'id' | 'isDefault'>): Promise<AccountRecord>;
  makeDefaultAccount(id: string): Promise<void>;

  listNamed(table: CatalogTable): Promise<NamedRecord[]>;
  findNamed(table: CatalogTable, id: string): Promise<NamedRecord | null>;
  saveNamed(table: CatalogTable, id: string | null, data: { name: string; active: boolean }): Promise<NamedRecord>;

  listStatuses(): Promise<{ id: string; name: string; color: string; system: boolean }[]>;
  findStatus(id: string): Promise<{ id: string } | null>;
}
