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

/** Interface pública do módulo finance. */
export interface FinanceFacade {
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
