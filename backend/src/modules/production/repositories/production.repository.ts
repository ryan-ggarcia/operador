import type { FieldChange } from '../../../shared/history/diff.js';
import type { ValueType } from '../../../shared/money/money.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { BillingType } from '../../finance/public/billing.js';

export const PRODUCTION_REPOSITORY = Symbol('PRODUCTION_REPOSITORY');
export const PRODUCTION_CATALOG_REPOSITORY = Symbol('PRODUCTION_CATALOG_REPOSITORY');

export type ProductionSituation = 'OPEN' | 'DONE' | 'CANCELED';

export interface ProductionHeader {
  title: string;
  clientContactId: string | null;
  responsibleId: string | null;
  statusId: string | null;
  deadline: Date | null;
  validityDays: number | null;
  taxId: string | null;
  taxPercent: number;
  paymentConditions: string | null;
  clientNotes: string | null;
  briefing: string | null;
}

export interface ProductionRecord extends ProductionHeader {
  id: string;
  projectId: string;
  sequence: number;
  clientId: string;
  requesterId: string | null;
  situation: ProductionSituation;
  statusIgnoresDelay: boolean;
  totalValue: number;
  commissionTotal: number;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberIds: string[];
  /** Algum pedido já foi enviado ao financeiro. */
  sentToFinance: boolean;
}

export interface QuoteRecord {
  id: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  commissionValue: number;
  feeValue: number;
  approved: boolean;
}

export interface ItemSupplierRecord {
  id: string;
  supplierId: string;
  estimateNumber: string | null;
  dueDate: Date | null;
  orderGroup: number;
  quotes: QuoteRecord[];
}

export interface ItemData {
  title: string;
  description: string | null;
  quantities: number[];
  commissionType: ValueType;
  commissionValue: number;
  feeType: ValueType;
  feeValue: number;
}

export interface ItemRecord extends ItemData {
  id: string;
  sequence: number;
  suppliers: ItemSupplierRecord[];
}

export interface OrderData {
  billingType: BillingType | null;
  discount: number;
  negotiatedCommission: number | null;
  supplierNotes: string | null;
  deliveryPlace: string | null;
  deliveryDate: Date | null;
  firstDueDate: Date | null;
}

export interface OrderTotalsData {
  subtotal: number;
  total: number;
  commission: number;
  fee: number;
  tax: number;
  netValue: number;
  valueToPass: number;
}

export interface OrderRecord extends OrderData, OrderTotalsData {
  id: string;
  supplierId: string;
  orderGroup: number;
  approvedById: string | null;
  approvedAt: Date | null;
  sentToFinanceAt: Date | null;
}

export interface ProductionDetail extends ProductionRecord {
  items: ItemRecord[];
  orders: OrderRecord[];
}

export interface ProductionFilter {
  visibility: { userId: string; readAll: boolean };
  search?: string;
  situations?: ProductionSituation[];
  clientId?: string;
  projectId?: string;
  supplierId?: string;
  mine?: boolean;
  limit: number;
  offset: number;
}

export interface NewProduction {
  projectId: string;
  sequence: number;
  clientId: string;
  title: string;
  responsibleId: string | null;
  requesterId: string;
  statusId: string | null;
  deadline: Date | null;
  briefing: string | null;
  taxId: string | null;
  taxPercent: number;
}

type HistoryRow = {
  id: string;
  userId: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

/** Produções, itens, cotações e pedidos (schema "production"). */
export interface ProductionRepository {
  list(filter: ProductionFilter): Promise<Page<ProductionRecord>>;
  findById(id: string): Promise<ProductionDetail | null>;
  create(data: NewProduction, actorId: string): Promise<ProductionRecord>;
  updateHeader(id: string, changes: Partial<ProductionHeader>, actorId: string, history: FieldChange[]): Promise<void>;
  saveTotals(id: string, totals: { totalValue: number; commissionTotal: number }): Promise<void>;
  changeSituation(id: string, situation: ProductionSituation, actorId: string): Promise<void>;
  closeByProject(projectId: string, situation: 'DONE' | 'CANCELED', actorId: string): Promise<number>;
  addMembers(id: string, userIds: string[]): Promise<void>;
  removeMember(id: string, userId: string): Promise<void>;
  listHistory(id: string): Promise<HistoryRow[]>;

  createItem(productionId: string, data: ItemData): Promise<ItemRecord>;
  /** Atualiza o item; quantidades que saíram levam as cotações delas em todos os fornecedores. */
  updateItem(id: string, data: ItemData): Promise<void>;
  deleteItem(id: string): Promise<void>;

  addSupplier(itemId: string, data: { supplierId: string; estimateNumber: string | null; dueDate: Date | null; orderGroup: number }): Promise<void>;
  updateSupplier(id: string, data: { estimateNumber?: string | null; dueDate?: Date | null; orderGroup?: number }): Promise<void>;
  removeSupplier(id: string): Promise<void>;

  /** Grava (ou atualiza) a cotação de um fornecedor para uma quantidade. */
  saveQuote(itemSupplierId: string, quantity: number, values: { unitValue: number; totalValue: number; commissionValue: number; feeValue: number }): Promise<void>;
  /** Recalcula BV e honorários de várias cotações (ex.: o item mudou de condição). */
  updateQuoteValues(values: { id: string; commissionValue: number; feeValue: number }[]): Promise<void>;
  /** Aprova a quantidade do fornecedor (uma só por fornecedor no item); null desaprova. */
  setApproved(itemSupplierId: string, quantity: number | null): Promise<void>;

  /**
   * Deixa um pedido para cada fornecedor + grupo com cotação aprovada; os
   * que ficaram sem aprovação somem (se não foram enviados).
   */
  syncOrders(productionId: string, keys: { supplierId: string; orderGroup: number }[]): Promise<void>;
  updateOrder(id: string, data: Partial<OrderData>): Promise<void>;
  saveOrderTotals(id: string, totals: OrderTotalsData): Promise<void>;
  setOrderSent(id: string, at: Date | null, snapshot: unknown, actorId: string): Promise<void>;
}

export interface TaxRecord {
  id: string;
  title: string;
  type: string | null;
  percent: number;
  isDefault: boolean;
  active: boolean;
}

export interface StatusRecord {
  id: string;
  name: string;
  color: string;
  order: number;
  active: boolean;
  ignoresDelay: boolean;
}

export type PredefinedTextKind = 'PAYMENT_CONDITION' | 'CLIENT_NOTE' | 'SUPPLIER_NOTE' | 'BRIEFING';

export interface PredefinedTextRecord {
  id: string;
  kind: PredefinedTextKind;
  title: string;
  html: string;
  active: boolean;
}

/** Encargos, status e textos predefinidos da produção. */
export interface ProductionCatalogRepository {
  listTaxes(): Promise<TaxRecord[]>;
  findTax(id: string): Promise<TaxRecord | null>;
  findDefaultTax(): Promise<TaxRecord | null>;
  saveTax(id: string | null, data: Omit<TaxRecord, 'id' | 'isDefault'>): Promise<TaxRecord>;
  makeDefaultTax(id: string): Promise<void>;
  listStatuses(includeInactive: boolean): Promise<StatusRecord[]>;
  findStatus(id: string): Promise<StatusRecord | null>;
  listTexts(kind?: PredefinedTextKind): Promise<PredefinedTextRecord[]>;
  saveText(id: string | null, data: Omit<PredefinedTextRecord, 'id'>): Promise<PredefinedTextRecord>;
}
