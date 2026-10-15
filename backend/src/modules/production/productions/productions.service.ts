import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diffFields } from '../../../shared/history/diff.js';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import type { ValueType } from '../../../shared/money/money.js';
import { endOfLocalDay } from '../../../shared/time/timezone.js';
import type { Page } from '../../../shared/validation/pagination.js';
import { AUTH_FACADE, READ_ALL, type AuthFacade, type UserPermissions } from '../../auth/public/index.js';
import { CRM_FACADE, type CrmFacade } from '../../crm/public/index.js';
import {
  BillingError,
  billingPlan,
  FINANCE_FACADE,
  type BillingType,
  type FinanceFacade,
  type FinanceInvoiceClass,
  type PlannedInvoice,
  type SourceBill,
} from '../../finance/public/index.js';
import { PROJECTS_FACADE, type ProjectsFacade } from '../../projects/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import {
  canActOnProduction,
  canCreateProduction,
  canEditProduction,
  canViewProduction,
  nextProductionSituation,
} from '../domain/production-access.js';
import {
  normalizeQuantities,
  orderTotals,
  ProductionMathError,
  quoteValues,
  type OrderTotals,
  type QuoteValues,
} from '../domain/production-math.js';
import {
  PRODUCTION_CATALOG_REPOSITORY,
  PRODUCTION_REPOSITORY,
  type ItemData,
  type ItemRecord,
  type OrderData,
  type OrderRecord,
  type ProductionCatalogRepository,
  type ProductionDetail,
  type ProductionHeader,
  type ProductionRecord,
  type ProductionRepository,
  type ProductionSituation,
} from '../repositories/production.repository.js';

const HISTORY_FIELDS = [
  'title', 'clientContactId', 'responsibleId', 'statusId', 'deadline', 'validityDays', 'taxId',
  'taxPercent', 'paymentConditions', 'clientNotes', 'briefing',
] as const;

type Ref = { id: string; name: string } | null;

export interface ProductionListQuery {
  search?: string;
  situations?: ProductionSituation[];
  clientId?: string;
  projectId?: string;
  supplierId?: string;
  mine?: boolean;
  limit: number;
  offset: number;
}

export interface CreateProductionInput {
  title: string;
  clientId: string;
  projectId?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  deadline?: string | null;
  briefing?: string | null;
}

export type ProductionHeaderInput = Partial<Omit<ProductionHeader, 'deadline' | 'taxPercent'> & { deadline: string | null }>;

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

export interface OrderView extends OrderRecord {
  supplier: Ref;
  /** Itens e quantidades aprovados deste fornecedor (e grupo). */
  lines: { itemId: string; number: string; title: string; quantity: number; unitValue: number; total: number; commission: number; fee: number }[];
  totals: OrderTotals | null;
  invoices: PlannedInvoice[];
  bills: SourceBill[];
  warnings: string[];
}

export interface ProductionView {
  id: string;
  number: string;
  title: string;
  client: Ref;
  clientContact: Ref;
  project: { id: string; number: number; title: string } | null;
  responsible: { id: string; name: string; color: string | null } | null;
  requester: { id: string; name: string; color: string | null } | null;
  members: { id: string; name: string; color: string | null }[];
  statusId: string | null;
  situation: ProductionSituation;
  deadline: Date | null;
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
  createdAt: Date;
  updatedAt: Date;
  items?: (ItemRecord & {
    number: string;
    suppliers: (ItemRecord['suppliers'][number] & { supplier: Ref; locked: boolean })[];
  })[];
  orders?: OrderView[];
  can: { edit: boolean; act: boolean };
}

const toDateOnly = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`Data inválida: ${value}.`);
  return new Date(`${value}T00:00:00.000Z`);
};

const key = (supplierId: string, orderGroup: number) => `${supplierId}:${orderGroup}`;

function math<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof ProductionMathError || error instanceof BillingError) throw new BadRequestException(error.message);
    throw error;
  }
}

/** Produções: cotação (itens, quantidades, fornecedores) e pedidos de produção. */
@Injectable()
export class ProductionsService {
  constructor(
    @Inject(PRODUCTION_REPOSITORY) private readonly productions: ProductionRepository,
    @Inject(PRODUCTION_CATALOG_REPOSITORY) private readonly catalog: ProductionCatalogRepository,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
    @Inject(CRM_FACADE) private readonly crm: CrmFacade,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
    @Inject(FINANCE_FACADE) private readonly finance: FinanceFacade,
  ) {}

  async list(userId: string, access: UserPermissions, query: ProductionListQuery): Promise<Page<ProductionView>> {
    const page = await this.productions.list({
      ...query,
      visibility: { userId, readAll: access.modules.productions >= READ_ALL },
    });
    const names = await this.names(page.items, []);
    const now = new Date();
    return { total: page.total, items: page.items.map((item) => this.toView(userId, access, item, names, now)) };
  }

  async get(userId: string, access: UserPermissions, id: string): Promise<ProductionView> {
    const production = await this.requireViewable(userId, access, id);
    const supplierIds = production.items.flatMap((item) => item.suppliers.map((supplier) => supplier.supplierId));
    const names = await this.names([production], supplierIds);
    const locked = this.lockedKeys(production);
    const prefix = this.toView(userId, access, production, names, new Date()).number;
    const orders = await Promise.all(production.orders.map((order) => this.orderView(production, order, prefix, names)));
    return {
      ...this.toView(userId, access, production, names, new Date()),
      items: production.items.map((item) => ({
        ...item,
        number: `${prefix}.${item.sequence}`,
        suppliers: item.suppliers.map((supplier) => ({
          ...supplier,
          supplier: names.party(supplier.supplierId),
          locked: locked.has(key(supplier.supplierId, supplier.orderGroup)),
        })),
      })),
      orders,
    };
  }

  async create(userId: string, access: UserPermissions, input: CreateProductionInput): Promise<ProductionView> {
    if (!canCreateProduction(access)) throw new ForbiddenException('Sem permissão para criar produções.');
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título.');
    const client = await this.crm.getParty(input.clientId);
    if (!client || !client.active || !client.roles.includes('client')) {
      throw new BadRequestException('Cliente não encontrado ou inativo.');
    }
    if (input.responsibleId) await this.requireActiveUser(input.responsibleId);
    if (input.statusId) await this.requireStatus(input.statusId);
    let projectId = input.projectId ?? null;
    if (projectId) {
      const project = await this.projects.getProject(projectId);
      if (!project || project.clientId !== input.clientId) throw new BadRequestException('Projeto não encontrado para este cliente.');
    } else {
      projectId = (await this.projects.ensureClientDefaultProject(input.clientId)).id;
    }
    const { sequence } = await this.projects.reserveDocumentSequence(projectId);
    const tax = await this.catalog.findDefaultTax();
    const production = await this.productions.create(
      {
        projectId,
        sequence,
        clientId: input.clientId,
        title,
        responsibleId: input.responsibleId ?? null,
        requesterId: userId,
        statusId: input.statusId ?? null,
        deadline: await this.parseDeadline(input.deadline),
        briefing: sanitizeRichText(input.briefing),
        taxId: tax?.id ?? null,
        taxPercent: tax?.percent ?? 0,
      },
      userId,
    );
    return this.get(userId, access, production.id);
  }

  /** Cabeçalho; trocar o encargo recalcula os pedidos. */
  async update(userId: string, access: UserPermissions, id: string, input: ProductionHeaderInput): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const { deadline, ...rest } = input;
    const changes: Partial<ProductionHeader> = {
      ...rest,
      title: rest.title?.trim() || undefined,
      deadline: deadline === undefined ? undefined : await this.parseDeadline(deadline),
      briefing: rest.briefing === undefined ? undefined : sanitizeRichText(rest.briefing),
      paymentConditions: rest.paymentConditions === undefined ? undefined : rest.paymentConditions?.trim() || null,
      clientNotes: rest.clientNotes === undefined ? undefined : rest.clientNotes?.trim() || null,
    };
    for (const field of Object.keys(changes) as (keyof ProductionHeader)[]) {
      if (changes[field] === undefined) delete changes[field];
    }
    if (changes.clientContactId) {
      const [contact] = await this.crm.getContacts([changes.clientContactId]);
      if (!contact || contact.partyId !== production.clientId) throw new BadRequestException('O contato não é deste cliente.');
    }
    if (changes.responsibleId) await this.requireActiveUser(changes.responsibleId);
    if (changes.statusId) await this.requireStatus(changes.statusId);
    if (changes.taxId !== undefined) {
      if (production.orders.some((order) => order.sentToFinanceAt)) {
        throw new BadRequestException('Há pedido enviado ao financeiro: reabra o faturamento antes de trocar o encargo.');
      }
      const tax = changes.taxId ? await this.catalog.findTax(changes.taxId) : null;
      if (changes.taxId && (!tax || !tax.active)) throw new BadRequestException('Encargo não encontrado.');
      changes.taxPercent = tax?.percent ?? 0;
    }
    await this.productions.updateHeader(id, changes, userId, diffFields(production, changes, HISTORY_FIELDS));
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  async act(userId: string, access: UserPermissions, id: string, action: 'complete' | 'cancel' | 'reopen'): Promise<ProductionView> {
    const production = await this.requireViewable(userId, access, id);
    if (!canActOnProduction(userId, access, production)) throw new ForbiddenException('Sem permissão para alterar esta produção.');
    const next = nextProductionSituation(production.situation, action);
    if (!next) throw new BadRequestException('A produção já está nesta situação.');
    if (next === 'OPEN') {
      const project = await this.projects.getProject(production.projectId);
      if (project?.situation !== 'OPEN') throw new BadRequestException('Reabra o projeto antes de reabrir a produção.');
    }
    if (next === 'CANCELED' && production.orders.some((order) => order.sentToFinanceAt)) {
      throw new BadRequestException('Há pedido enviado ao financeiro: reabra o faturamento antes de cancelar.');
    }
    await this.productions.changeSituation(id, next, userId);
    return this.get(userId, access, id);
  }

  async addMembers(userId: string, access: UserPermissions, id: string, userIds: string[]): Promise<ProductionView> {
    await this.requireEditable(userId, access, id);
    const unique = [...new Set(userIds)];
    const users = await this.auth.getUsers(unique);
    if (users.length !== unique.length || users.some((user) => !user.active)) {
      throw new BadRequestException('Usuário não encontrado ou inativo.');
    }
    await this.productions.addMembers(id, unique);
    return this.get(userId, access, id);
  }

  async removeMember(userId: string, access: UserPermissions, id: string, memberId: string): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    if (production.responsibleId === memberId) throw new BadRequestException('O responsável não pode sair dos envolvidos.');
    await this.productions.removeMember(id, memberId);
    return this.get(userId, access, id);
  }

  async history(userId: string, access: UserPermissions, id: string) {
    await this.requireViewable(userId, access, id);
    return this.productions.listHistory(id);
  }

  // ---------- Cotação: itens ----------

  async addItem(userId: string, access: UserPermissions, id: string, input: ItemInput): Promise<ProductionView> {
    await this.requireEditable(userId, access, id);
    await this.productions.createItem(id, this.itemData(input));
    return this.get(userId, access, id);
  }

  /**
   * Altera o item. Tirar uma quantidade apaga a cotação dela em todos os
   * fornecedores; mudar BV/honorários recalcula as cotações.
   */
  async updateItem(userId: string, access: UserPermissions, id: string, itemId: string, input: ItemInput): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const item = this.requireItem(production, itemId);
    const data = this.itemData({ ...item, ...input });
    const locked = this.lockedKeys(production);
    const touchesLocked = item.suppliers.some((supplier) => locked.has(key(supplier.supplierId, supplier.orderGroup)));
    const removed = item.quantities.filter((quantity) => !data.quantities.includes(quantity));
    const termsChanged = (['commissionType', 'commissionValue', 'feeType', 'feeValue'] as const).some(
      (field) => data[field] !== item[field],
    );
    if (touchesLocked && (removed.length > 0 || termsChanged)) {
      throw new BadRequestException('Há fornecedor deste item enviado ao financeiro: reabra o faturamento antes.');
    }
    await this.productions.updateItem(itemId, data);
    if (termsChanged) {
      const values = item.suppliers.flatMap((supplier) =>
        supplier.quotes
          .filter((quote) => data.quantities.includes(quote.quantity))
          .map((quote) => {
            const computed = quoteValues(quote.quantity, quote.unitValue, data);
            return { id: quote.id, commissionValue: computed.commission, feeValue: computed.fee };
          }),
      );
      if (values.length) await this.productions.updateQuoteValues(values);
    }
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  async removeItem(userId: string, access: UserPermissions, id: string, itemId: string): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const item = this.requireItem(production, itemId);
    this.assertUnlocked(production, item.suppliers);
    await this.productions.deleteItem(itemId);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  // ---------- Cotação: fornecedores e valores ----------

  async addSupplier(
    userId: string,
    access: UserPermissions,
    id: string,
    itemId: string,
    input: { supplierId: string; estimateNumber?: string | null; dueDate?: string | null; orderGroup?: number },
  ): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const item = this.requireItem(production, itemId);
    const supplier = await this.crm.getParty(input.supplierId);
    if (!supplier || !supplier.active || !supplier.roles.includes('supplier')) {
      throw new BadRequestException('Fornecedor não encontrado ou inativo.');
    }
    if (item.suppliers.some((current) => current.supplierId === input.supplierId)) {
      throw new BadRequestException('Este fornecedor já está no item.');
    }
    await this.productions.addSupplier(itemId, {
      supplierId: input.supplierId,
      estimateNumber: input.estimateNumber?.trim() || null,
      dueDate: toDateOnly(input.dueDate) ?? null,
      orderGroup: input.orderGroup ?? 0,
    });
    return this.get(userId, access, id);
  }

  async updateSupplier(
    userId: string,
    access: UserPermissions,
    id: string,
    itemSupplierId: string,
    input: { estimateNumber?: string | null; dueDate?: string | null; orderGroup?: number },
  ): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const { supplier } = this.requireItemSupplier(production, itemSupplierId);
    if (input.orderGroup !== undefined && input.orderGroup !== supplier.orderGroup) this.assertUnlocked(production, [supplier]);
    await this.productions.updateSupplier(itemSupplierId, {
      estimateNumber: input.estimateNumber === undefined ? undefined : input.estimateNumber?.trim() || null,
      dueDate: toDateOnly(input.dueDate),
      orderGroup: input.orderGroup,
    });
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  async removeSupplier(userId: string, access: UserPermissions, id: string, itemSupplierId: string): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const { supplier } = this.requireItemSupplier(production, itemSupplierId);
    this.assertUnlocked(production, [supplier]);
    await this.productions.removeSupplier(itemSupplierId);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  /** Valor cotado pelo fornecedor para uma quantidade do item. */
  async saveQuote(
    userId: string,
    access: UserPermissions,
    id: string,
    itemSupplierId: string,
    input: { quantity: number; unitValue: number },
  ): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const { item, supplier } = this.requireItemSupplier(production, itemSupplierId);
    this.assertUnlocked(production, [supplier]);
    if (!item.quantities.includes(input.quantity)) throw new BadRequestException('Quantidade não cotada neste item.');
    const values = math(() => quoteValues(input.quantity, input.unitValue, item));
    await this.productions.saveQuote(itemSupplierId, input.quantity, {
      unitValue: input.unitValue,
      totalValue: values.total,
      commissionValue: values.commission,
      feeValue: values.fee,
    });
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  /** Aprova a quantidade de um fornecedor no item (null desaprova). */
  async approve(
    userId: string,
    access: UserPermissions,
    id: string,
    itemSupplierId: string,
    quantity: number | null,
  ): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const { supplier } = this.requireItemSupplier(production, itemSupplierId);
    this.assertUnlocked(production, [supplier]);
    if (quantity !== null && !supplier.quotes.some((quote) => quote.quantity === quantity && quote.unitValue > 0)) {
      throw new BadRequestException('Informe o valor desta quantidade antes de aprovar.');
    }
    await this.productions.setApproved(itemSupplierId, quantity);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  // ---------- Pedidos de produção ----------

  async updateOrder(userId: string, access: UserPermissions, id: string, orderId: string, input: OrderInput): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const order = this.requireOrder(production, orderId);
    if (order.sentToFinanceAt) throw new BadRequestException('O pedido foi enviado ao financeiro: reabra o faturamento para alterar.');
    const data: Partial<OrderData> = {
      billingType: input.billingType,
      discount: input.discount,
      negotiatedCommission: input.negotiatedCommission,
      supplierNotes: input.supplierNotes === undefined ? undefined : input.supplierNotes?.trim() || null,
      deliveryPlace: input.deliveryPlace === undefined ? undefined : input.deliveryPlace?.trim() || null,
      deliveryDate: toDateOnly(input.deliveryDate),
      firstDueDate: toDateOnly(input.firstDueDate),
    };
    const next = { ...order, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) };
    math(() => {
      const totals = orderTotals({
        quotes: this.approvedQuotes(production, order).map((line) => line.values),
        discount: next.discount,
        negotiatedCommission: next.negotiatedCommission,
        taxPercent: production.taxPercent,
      });
      if (next.billingType) billingPlan(next.billingType, totals, next.negotiatedCommission != null);
    });
    await this.productions.updateOrder(orderId, data);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  /** Envia as faturas do pedido (as que passam pela agência) e trava o fornecedor. */
  async sendOrderToFinance(userId: string, access: UserPermissions, id: string, orderId: string): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const order = this.requireOrder(production, orderId);
    if (order.sentToFinanceAt) throw new BadRequestException('O pedido já foi enviado ao financeiro.');
    if (!order.billingType) throw new BadRequestException('Escolha o tipo de faturamento do pedido.');
    if (!order.firstDueDate) throw new BadRequestException('Informe o 1º vencimento do pedido.');
    const billingType = order.billingType;
    const lines = this.approvedQuotes(production, order);
    const { totals, invoices } = math(() => {
      const computed = orderTotals({
        quotes: lines.map((line) => line.values),
        discount: order.discount,
        negotiatedCommission: order.negotiatedCommission,
        taxPercent: production.taxPercent,
      });
      return { totals: computed, invoices: billingPlan(billingType, computed, order.negotiatedCommission != null) };
    });
    if (totals.total <= 0) throw new BadRequestException('O pedido está sem valor.');
    const names = await this.names([production], [order.supplierId]);
    const number = this.toView(userId, access, production, names, new Date()).number;
    const supplierName = names.party(order.supplierId)?.name ?? 'fornecedor';
    const dueDate = order.firstDueDate.toISOString().slice(0, 10);
    await this.finance.createBillsFromSource(
      'PRODUCTION',
      order.id,
      invoices
        .filter((invoice) => invoice.kind !== null)
        .map((invoice) => {
          const party = invoice.kind === 'REVENUE' ? invoice.payer : invoice.payee;
          return {
            kind: invoice.kind!,
            invoiceClass: invoice.invoiceClass as FinanceInvoiceClass,
            partyType: party === 'client' ? 'CLIENT' : 'SUPPLIER',
            partyId: party === 'client' ? production.clientId : order.supplierId,
            title: `PP ${number} — ${supplierName}`,
            amount: invoice.amount,
            dueDate,
            clientId: production.clientId,
            projectId: production.projectId,
          };
        }),
      userId,
    );
    await this.productions.setOrderSent(
      order.id,
      new Date(),
      {
        client: names.party(production.clientId),
        supplier: names.party(order.supplierId),
        lines: lines.map(({ values, ...line }) => ({ ...line, ...values })),
        totals,
        invoices,
        billingType,
        firstDueDate: dueDate,
      },
      userId,
    );
    return this.get(userId, access, id);
  }

  async reopenOrderBilling(userId: string, access: UserPermissions, id: string, orderId: string): Promise<ProductionView> {
    const production = await this.requireEditable(userId, access, id);
    const order = this.requireOrder(production, orderId);
    if (!order.sentToFinanceAt) throw new BadRequestException('O pedido não foi enviado ao financeiro.');
    await this.finance.reopenSource('PRODUCTION', order.id, userId);
    await this.productions.setOrderSent(order.id, null, null, userId);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  // ---------- Apoio ----------

  async requireViewable(userId: string, access: UserPermissions, id: string): Promise<ProductionDetail> {
    const production = await this.productions.findById(id);
    if (!production || !canViewProduction(userId, access, production)) throw new NotFoundException('Produção não encontrada.');
    return production;
  }

  private async requireEditable(userId: string, access: UserPermissions, id: string): Promise<ProductionDetail> {
    const production = await this.requireViewable(userId, access, id);
    if (!canEditProduction(userId, access, production)) {
      throw new ForbiddenException(
        production.situation !== 'OPEN' ? 'A produção está fechada: reabra para alterar.' : 'Sem permissão para alterar esta produção.',
      );
    }
    return production;
  }

  private requireItem(production: ProductionDetail, itemId: string): ItemRecord {
    const item = production.items.find((current) => current.id === itemId);
    if (!item) throw new NotFoundException('Item não encontrado.');
    return item;
  }

  private requireItemSupplier(production: ProductionDetail, itemSupplierId: string) {
    for (const item of production.items) {
      const supplier = item.suppliers.find((current) => current.id === itemSupplierId);
      if (supplier) return { item, supplier };
    }
    throw new NotFoundException('Fornecedor do item não encontrado.');
  }

  private requireOrder(production: ProductionDetail, orderId: string): OrderRecord {
    const order = production.orders.find((current) => current.id === orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  /** Fornecedor + grupo cujo pedido já foi enviado ao financeiro. */
  private lockedKeys(production: ProductionDetail): Set<string> {
    return new Set(
      production.orders.filter((order) => order.sentToFinanceAt).map((order) => key(order.supplierId, order.orderGroup)),
    );
  }

  private assertUnlocked(production: ProductionDetail, suppliers: { supplierId: string; orderGroup: number }[]): void {
    const locked = this.lockedKeys(production);
    if (suppliers.some((supplier) => locked.has(key(supplier.supplierId, supplier.orderGroup)))) {
      throw new BadRequestException('O fornecedor já foi enviado ao financeiro: reabra o faturamento do pedido antes.');
    }
  }

  private itemData(input: ItemInput): ItemData {
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Informe o título do item.');
    return {
      title,
      description: input.description?.trim() || null,
      quantities: math(() => normalizeQuantities(input.quantities ?? [])),
      commissionType: input.commissionType ?? 'PERCENT',
      commissionValue: input.commissionValue ?? 0,
      feeType: input.feeType ?? 'PERCENT',
      feeValue: input.feeValue ?? 0,
    };
  }

  /** Cotações aprovadas do fornecedor do pedido (no mesmo grupo). */
  private approvedQuotes(production: ProductionDetail, order: Pick<OrderRecord, 'supplierId' | 'orderGroup'>) {
    const lines: { itemId: string; sequence: number; title: string; quantity: number; unitValue: number; values: QuoteValues }[] = [];
    for (const item of production.items) {
      for (const supplier of item.suppliers) {
        if (supplier.supplierId !== order.supplierId || supplier.orderGroup !== order.orderGroup) continue;
        const quote = supplier.quotes.find((current) => current.approved);
        if (quote) {
          lines.push({
            itemId: item.id,
            sequence: item.sequence,
            title: item.title,
            quantity: quote.quantity,
            unitValue: quote.unitValue,
            values: { total: quote.totalValue, commission: quote.commissionValue, fee: quote.feeValue },
          });
        }
      }
    }
    return lines;
  }

  /** Pedidos conforme as aprovações, e totais gravados para as pautas. */
  private async recalculate(id: string): Promise<void> {
    let production = await this.productions.findById(id);
    if (!production) return;
    const keys = new Map<string, { supplierId: string; orderGroup: number }>();
    for (const item of production.items) {
      for (const supplier of item.suppliers) {
        if (supplier.quotes.some((quote) => quote.approved)) {
          keys.set(key(supplier.supplierId, supplier.orderGroup), { supplierId: supplier.supplierId, orderGroup: supplier.orderGroup });
        }
      }
    }
    await this.productions.syncOrders(id, [...keys.values()]);
    production = (await this.productions.findById(id))!;
    let totalValue = 0;
    let commissionTotal = 0;
    for (const order of production.orders) {
      try {
        const totals = orderTotals({
          quotes: this.approvedQuotes(production, order).map((line) => line.values),
          discount: order.discount,
          negotiatedCommission: order.negotiatedCommission,
          taxPercent: production.taxPercent,
        });
        totalValue += totals.total;
        commissionTotal += totals.commission;
        await this.productions.saveOrderTotals(order.id, {
          subtotal: totals.subtotal,
          total: totals.total,
          commission: totals.commission,
          fee: totals.fee,
          tax: totals.tax,
          netValue: totals.net,
          valueToPass: totals.valueToPass,
        });
      } catch (error) {
        if (!(error instanceof ProductionMathError)) throw error;
      }
    }
    await this.productions.saveTotals(id, {
      totalValue: Math.round(totalValue * 100) / 100,
      commissionTotal: Math.round(commissionTotal * 100) / 100,
    });
  }

  private async orderView(
    production: ProductionDetail,
    order: OrderRecord,
    prefix: string,
    names: Awaited<ReturnType<ProductionsService['names']>>,
  ): Promise<OrderView> {
    const lines = this.approvedQuotes(production, order);
    const warnings: string[] = [];
    let totals: OrderTotals | null = null;
    let invoices: PlannedInvoice[] = [];
    try {
      totals = orderTotals({
        quotes: lines.map((line) => line.values),
        discount: order.discount,
        negotiatedCommission: order.negotiatedCommission,
        taxPercent: production.taxPercent,
      });
      if (order.billingType) invoices = billingPlan(order.billingType, totals, order.negotiatedCommission != null);
    } catch (error) {
      if (!(error instanceof ProductionMathError || error instanceof BillingError)) throw error;
      warnings.push(error.message);
    }
    if (!order.billingType) warnings.push('Escolha o tipo de faturamento.');
    if (!order.firstDueDate) warnings.push('Informe o 1º vencimento.');
    return {
      ...order,
      supplier: names.party(order.supplierId),
      lines: lines.map((line) => ({
        itemId: line.itemId,
        number: `${prefix}.${line.sequence}`,
        title: line.title,
        quantity: line.quantity,
        unitValue: line.unitValue,
        total: line.values.total,
        commission: line.values.commission,
        fee: line.values.fee,
      })),
      totals,
      invoices,
      bills: order.sentToFinanceAt ? await this.finance.getBillsBySource('PRODUCTION', order.id) : [],
      warnings,
    };
  }

  private async requireActiveUser(userId: string): Promise<void> {
    const [user] = await this.auth.getUsers([userId]);
    if (!user || !user.active) throw new BadRequestException('Responsável não encontrado ou inativo.');
  }

  private async requireStatus(statusId: string): Promise<void> {
    const status = await this.catalog.findStatus(statusId);
    if (!status || !status.active) throw new BadRequestException('Status de produção não encontrado.');
  }

  private async parseDeadline(value: string | null | undefined): Promise<Date | null> {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Prazo inválido.');
    const { timezone } = await this.settings.getAgency();
    return endOfLocalDay(value, timezone);
  }

  private async names(productions: ProductionRecord[], supplierIds: string[]) {
    const partyIds = [...productions.map((production) => production.clientId), ...supplierIds];
    const contactIds = productions.map((production) => production.clientContactId).filter((id): id is string => Boolean(id));
    const userIds = productions
      .flatMap((production) => [production.responsibleId, production.requesterId, ...production.memberIds])
      .filter((id): id is string => Boolean(id));
    const [parties, contacts, users, projects] = await Promise.all([
      this.crm.getParties(partyIds),
      this.crm.getContacts(contactIds),
      this.auth.getUsers([...new Set(userIds)]),
      this.projects.getProjects(productions.map((production) => production.projectId)),
    ]);
    const partyMap = new Map(parties.map((party) => [party.id, { id: party.id, name: party.name }]));
    const contactMap = new Map(contacts.map((contact) => [contact.id, { id: contact.id, name: contact.name }]));
    const userMap = new Map(users.map((user) => [user.id, { id: user.id, name: user.name, color: user.color }]));
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    return {
      party: (id: string | null) => (id ? (partyMap.get(id) ?? null) : null),
      contact: (id: string | null) => (id ? (contactMap.get(id) ?? null) : null),
      user: (id: string | null) => (id ? (userMap.get(id) ?? null) : null),
      project: (id: string) => projectMap.get(id) ?? null,
    };
  }

  private toView(
    userId: string,
    access: UserPermissions,
    production: ProductionRecord,
    names: Awaited<ReturnType<ProductionsService['names']>>,
    now: Date,
  ): ProductionView {
    const project = names.project(production.projectId);
    return {
      id: production.id,
      number: project ? `${project.number}.${production.sequence}` : String(production.sequence),
      title: production.title,
      client: names.party(production.clientId),
      clientContact: names.contact(production.clientContactId),
      project: project ? { id: project.id, number: project.number, title: project.title } : null,
      responsible: names.user(production.responsibleId),
      requester: names.user(production.requesterId),
      members: production.memberIds.map((member) => names.user(member)).filter((user) => user !== null),
      statusId: production.statusId,
      situation: production.situation,
      deadline: production.deadline,
      overdue:
        production.situation === 'OPEN' && !production.statusIgnoresDelay && production.deadline !== null && production.deadline < now,
      validityDays: production.validityDays,
      taxId: production.taxId,
      taxPercent: production.taxPercent,
      paymentConditions: production.paymentConditions,
      clientNotes: production.clientNotes,
      briefing: production.briefing,
      totalValue: production.totalValue,
      commissionTotal: production.commissionTotal,
      sentToFinance: production.sentToFinance,
      createdAt: production.createdAt,
      updatedAt: production.updatedAt,
      can: {
        edit: canEditProduction(userId, access, production),
        act: canActOnProduction(userId, access, production),
      },
    };
  }
}
