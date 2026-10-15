import type { BillingType, PlannedInvoice, ValueType } from './media.service';
import type { HttpClient } from './http';
import type { NamedRef, Page, UserRef } from './types';

export type ProductionSituation = 'OPEN' | 'DONE' | 'CANCELED';

export interface Quote {
  id: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  commissionValue: number;
  feeValue: number;
  approved: boolean;
}

export interface ItemSupplier {
  id: string;
  supplierId: string;
  supplier: NamedRef | null;
  estimateNumber: string | null;
  dueDate: string | null;
  orderGroup: number;
  locked: boolean;
  quotes: Quote[];
}

export interface ProductionItem {
  id: string;
  number: string;
  sequence: number;
  title: string;
  description: string | null;
  quantities: number[];
  commissionType: ValueType;
  commissionValue: number;
  feeType: ValueType;
  feeValue: number;
  suppliers: ItemSupplier[];
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  total: number;
  commission: number;
  partial: number;
  net: number;
  fee: number;
  tax: number;
  valueToPass: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplier: NamedRef | null;
  orderGroup: number;
  billingType: BillingType | null;
  discount: number;
  negotiatedCommission: number | null;
  supplierNotes: string | null;
  deliveryPlace: string | null;
  deliveryDate: string | null;
  firstDueDate: string | null;
  sentToFinanceAt: string | null;
  approvedAt: string | null;
  lines: {
    itemId: string;
    number: string;
    title: string;
    quantity: number;
    unitValue: number;
    total: number;
    commission: number;
    fee: number;
  }[];
  totals: OrderTotals | null;
  invoices: PlannedInvoice[];
  bills: { id: string; kind: 'REVENUE' | 'EXPENSE'; amount: number; situation: 'OPEN' | 'PAID' | 'CANCELED' }[];
  warnings: string[];
}

export interface Production {
  id: string;
  number: string;
  title: string;
  client: NamedRef | null;
  clientContact: NamedRef | null;
  project: { id: string; number: number; title: string } | null;
  responsible: UserRef | null;
  requester: UserRef | null;
  members: UserRef[];
  statusId: string | null;
  situation: ProductionSituation;
  deadline: string | null;
  overdue: boolean;
  validityDays: number | null;
  taxId: string | null;
  taxPercent: number;
  paymentConditions: string | null;
  clientNotes: string | null;
  briefing: string | null;
  totalValue: number;
  commissionTotal: number;
  sentToFinance: boolean;
  createdAt: string;
  updatedAt: string;
  items?: ProductionItem[];
  orders?: PurchaseOrder[];
  can: { edit: boolean; act: boolean };
}

export interface ItemInput {
  title?: string;
  description?: string | null;
  quantities?: number[];
  commissionType?: ValueType;
  commissionValue?: number;
  feeType?: ValueType;
  feeValue?: number;
}

export interface OrderInput {
  billingType?: BillingType | null;
  discount?: number;
  negotiatedCommission?: number | null;
  supplierNotes?: string | null;
  deliveryPlace?: string | null;
  deliveryDate?: string | null;
  firstDueDate?: string | null;
}

export class ProductionService {
  constructor(private readonly http: HttpClient) {}

  list(query: { search?: string; situations?: ProductionSituation[]; mine?: boolean; limit?: number } = {}) {
    return this.http.get<Page<Production>>('/productions', { ...query });
  }
  get(id: string) {
    return this.http.get<Production>(`/productions/${id}`);
  }
  create(input: {
    title: string;
    clientId: string;
    projectId?: string | null;
    responsibleId?: string | null;
    deadline?: string | null;
  }) {
    return this.http.post<Production>('/productions', input);
  }
  update(
    id: string,
    input: Partial<
      Pick<Production, 'title' | 'validityDays' | 'taxId' | 'paymentConditions' | 'clientNotes' | 'statusId'>
    >,
  ) {
    return this.http.patch<Production>(`/productions/${id}`, input);
  }
  act(id: string, action: 'complete' | 'cancel' | 'reopen') {
    return this.http.post<Production>(`/productions/${id}/${action}`);
  }
  addItem(id: string, input: ItemInput) {
    return this.http.post<Production>(`/productions/${id}/items`, input);
  }
  updateItem(id: string, itemId: string, input: ItemInput) {
    return this.http.patch<Production>(`/productions/${id}/items/${itemId}`, input);
  }
  removeItem(id: string, itemId: string) {
    return this.http.delete<Production>(`/productions/${id}/items/${itemId}`);
  }
  addSupplier(id: string, itemId: string, supplierId: string) {
    return this.http.post<Production>(`/productions/${id}/items/${itemId}/suppliers`, { supplierId });
  }
  updateSupplier(id: string, itemSupplierId: string, input: { estimateNumber?: string | null; orderGroup?: number }) {
    return this.http.patch<Production>(`/productions/${id}/suppliers/${itemSupplierId}`, input);
  }
  removeSupplier(id: string, itemSupplierId: string) {
    return this.http.delete<Production>(`/productions/${id}/suppliers/${itemSupplierId}`);
  }
  saveQuote(id: string, itemSupplierId: string, quantity: number, unitValue: number) {
    return this.http.put<Production>(`/productions/${id}/suppliers/${itemSupplierId}/quotes`, { quantity, unitValue });
  }
  approve(id: string, itemSupplierId: string, quantity: number | null) {
    return this.http.post<Production>(`/productions/${id}/suppliers/${itemSupplierId}/approve`, { quantity });
  }
  updateOrder(id: string, orderId: string, input: OrderInput) {
    return this.http.patch<Production>(`/productions/${id}/orders/${orderId}`, input);
  }
  sendOrder(id: string, orderId: string) {
    return this.http.post<Production>(`/productions/${id}/orders/${orderId}/send-to-finance`);
  }
  reopenOrder(id: string, orderId: string) {
    return this.http.post<Production>(`/productions/${id}/orders/${orderId}/reopen-billing`);
  }
  taxes() {
    return this.http.get<{ id: string; title: string; percent: number; isDefault: boolean; active: boolean }[]>(
      '/production-settings/taxes',
    );
  }
  statuses() {
    return this.http.get<{ id: string; name: string; color: string; active: boolean }[]>(
      '/production-settings/statuses',
    );
  }
}
