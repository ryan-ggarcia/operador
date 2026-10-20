import type { HttpClient } from './http';
import type { NamedRef, Page } from './types';

export type BillKind = 'REVENUE' | 'EXPENSE';
export type BillSituation = 'OPEN' | 'PAID' | 'CANCELED';
export type BillPartyType = 'CLIENT' | 'SUPPLIER' | 'PROVIDER' | 'VEHICLE' | 'COLLABORATOR';
export type BillCondition = 'SINGLE' | 'INSTALLMENTS' | 'RECURRING';
export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';

export interface Bill {
  id: string;
  kind: BillKind;
  partyType: BillPartyType;
  partyId: string;
  party: NamedRef | null;
  client: NamedRef | null;
  project: { id: string; number: number; title: string } | null;
  title: string;
  categoryId: string;
  categoryName: string;
  accountId: string;
  accountName: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  additions: number;
  discounts: number;
  finalAmount: number;
  dueDate: string;
  paidAt: string | null;
  installmentGroupId: string | null;
  installmentNumber: number;
  installmentCount: number;
  condition: BillCondition;
  sourceType: 'MANUAL' | 'MEDIA' | 'PRODUCTION' | 'PROJECT' | 'JOB' | 'TRANSFER';
  sourceId: string | null;
  situation: BillSituation;
  documentNumber: string | null;
  notes: string | null;
  overdue: boolean;
  can: { edit: boolean };
}

export interface BillInput {
  kind: BillKind;
  partyType: BillPartyType;
  partyId: string;
  title: string;
  categoryId: string;
  accountId: string;
  paymentMethodId: string;
  amount: number;
  additions?: number;
  discounts?: number;
  dueDate: string;
  condition?: BillCondition;
  count?: number;
  frequency?: Frequency;
  documentNumber?: string | null;
  clientId?: string | null;
  notes?: string | null;
  paidAt?: string | null;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  kind: BillKind;
  active: boolean;
}

export interface Account {
  id: string;
  name: string;
  bank: string | null;
  agency: string | null;
  number: string | null;
  initialBalance: number;
  isDefault: boolean;
  active: boolean;
  balance: number;
}

export interface NamedOption {
  id: string;
  name: string;
  isDefault?: boolean;
  active: boolean;
}

export interface Transfer {
  id: string;
  title: string;
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amount: number;
  scheduled: boolean;
}

export interface FinanceSummary {
  revenuePaid: number;
  revenueOpen: number;
  expensePaid: number;
  expenseOpen: number;
  overdueRevenue: number;
  overdueExpense: number;
  transfers: number;
  realizedBalance: number;
  forecastBalance: number;
}

export class FinanceService {
  constructor(private readonly http: HttpClient) {}

  bills(query: {
    kinds?: BillKind[];
    situations?: BillSituation[];
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
  }) {
    return this.http.get<Page<Bill> & { totals: { revenue: number; expense: number } }>('/finance/bills', { ...query });
  }
  bill(id: string) {
    return this.http.get<Bill & { group: Bill[] }>(`/finance/bills/${id}`);
  }
  create(input: BillInput) {
    return this.http.post<Bill[]>('/finance/bills', input);
  }
  update(id: string, input: Partial<BillInput>) {
    return this.http.patch<Bill>(`/finance/bills/${id}`, input);
  }
  settle(ids: string[], paidAt: string) {
    return this.http.post<void>('/finance/bills/settle', { ids, paidAt });
  }
  cancel(id: string, scope: 'this' | 'next' | 'all' = 'this') {
    return this.http.post<void>(`/finance/bills/${id}/cancel`, { scope });
  }
  reopen(id: string) {
    return this.http.post<void>(`/finance/bills/${id}/reopen`);
  }
  summary(from: string, to: string) {
    return this.http.get<FinanceSummary>('/finance/summary', { from, to });
  }
  transfers(from?: string, to?: string) {
    return this.http.get<Transfer[]>('/finance/transfers', { from, to });
  }
  createTransfer(input: Omit<Transfer, 'id' | 'scheduled'>) {
    return this.http.post<Transfer>('/finance/transfers', input);
  }
  removeTransfer(id: string) {
    return this.http.delete<void>(`/finance/transfers/${id}`);
  }
  accounts() {
    return this.http.get<Account[]>('/finance/accounts');
  }
  categories() {
    return this.http.get<Category[]>('/finance/categories');
  }
  paymentMethods() {
    return this.http.get<NamedOption[]>('/finance/payment-methods');
  }
  saveCategory(id: string | null, input: { name: string; kind: BillKind; parentId: string | null; active?: boolean }) {
    return id
      ? this.http.patch<Category>(`/finance-settings/categories/${id}`, input)
      : this.http.post<Category>('/finance-settings/categories', input);
  }
  saveAccount(
    id: string | null,
    input: { name: string; bank?: string | null; initialBalance?: number; isDefault?: boolean; active?: boolean },
  ) {
    return id
      ? this.http.patch<Account>(`/finance-settings/accounts/${id}`, input)
      : this.http.post<Account>('/finance-settings/accounts', input);
  }
  savePaymentMethod(id: string | null, input: { name: string; active?: boolean }) {
    return id
      ? this.http.patch<NamedOption>(`/finance-settings/payment-methods/${id}`, input)
      : this.http.post<NamedOption>('/finance-settings/payment-methods', input);
  }
}

/** "Mãe › filha" para mostrar a categoria. */
export function categoryLabel(category: Category, all: Category[]): string {
  const parent = category.parentId ? all.find((item) => item.id === category.parentId) : undefined;
  return parent ? `${parent.name} › ${category.name}` : category.name;
}
