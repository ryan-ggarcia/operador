import type { UserPermissions } from '../../auth/public/index.js';

/** Token de injeção da fachada do módulo finance. */
export const FINANCE_FACADE = Symbol('FINANCE_FACADE');

export type FinanceSourceType = 'MEDIA' | 'PRODUCTION';

export type FinanceInvoiceClass =
  | 'AGENCY_RECEIVES_COMMISSION_CLIENT'
  | 'AGENCY_RECEIVES_COMMISSION_THIRD_PARTY'
  | 'AGENCY_RECEIVES_NET_CLIENT'
  | 'AGENCY_RECEIVES_TOTAL_CLIENT'
  | 'AGENCY_PAYS_NET_THIRD_PARTY'
  | 'AGENCY_PAYS_TOTAL_THIRD_PARTY'
  | 'FEE';

/** Uma fatura que um documento (mídia, produção) manda para o financeiro. */
export interface SourceBillInput {
  kind: 'REVENUE' | 'EXPENSE';
  invoiceClass: FinanceInvoiceClass;
  partyType: 'CLIENT' | 'SUPPLIER' | 'VEHICLE';
  partyId: string;
  title: string;
  amount: number;
  /** AAAA-MM-DD */
  dueDate: string;
  clientId: string;
  projectId: string | null;
  documentNumber?: string | null;
}

export interface SourceBill {
  id: string;
  kind: 'REVENUE' | 'EXPENSE';
  invoiceClass: FinanceInvoiceClass | null;
  title: string;
  amount: number;
  dueDate: Date;
  situation: 'OPEN' | 'PAID' | 'CANCELED';
}

export interface CashSummary {
  revenuePaid: number;
  revenueOpen: number;
  expensePaid: number;
  expenseOpen: number;
  balance: number;
}

/** Resumo do período como na tela do financeiro, mais o saldo das contas. */
export interface PeriodSummary {
  revenuePaid: number;
  revenueOpen: number;
  expensePaid: number;
  expenseOpen: number;
  /** Em aberto com vencimento antes do período. */
  overdueRevenue: number;
  overdueExpense: number;
  transfers: number;
  realizedBalance: number;
  forecastBalance: number;
  /** Sem leitura total no financeiro, só os lançamentos criados pelo usuário. */
  onlyOwnBills: boolean;
  /** Saldo de hoje das contas ativas. */
  accounts: { name: string; balance: number }[];
}

/** Interface pública do módulo finance. */
export interface FinanceFacade {
  /** Resumo do período (AAAA-MM-DD, fim exclusivo); sem acesso ao financeiro: 403. */
  getPeriodSummaryForUser(userId: string, access: UserPermissions, from: string, to: string): Promise<PeriodSummary>;
  /**
   * Cria as faturas do documento (conta, forma de pagamento e categoria
   * padrão). Devolve os ids na mesma ordem.
   */
  createBillsFromSource(
    sourceType: FinanceSourceType,
    sourceId: string,
    bills: SourceBillInput[],
    actorId: string,
  ): Promise<string[]>;
  getBillsBySource(sourceType: FinanceSourceType, sourceId: string): Promise<SourceBill[]>;
  /**
   * Cancela as faturas do documento para ele voltar a ser editado. Não deixa
   * se alguma já foi quitada.
   */
  reopenSource(sourceType: FinanceSourceType, sourceId: string, actorId: string): Promise<void>;
  /** Totais do período (AAAA-MM-DD, fim exclusivo). */
  getCashSummary(from: string, to: string): Promise<CashSummary>;
}
