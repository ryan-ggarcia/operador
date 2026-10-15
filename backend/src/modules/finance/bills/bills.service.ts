import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { diffFields } from '../../../shared/history/diff.js';
import type { Page } from '../../../shared/validation/pagination.js';
import { AUTH_FACADE, READ_ALL, type AuthFacade, type UserPermissions } from '../../auth/public/index.js';
import { CRM_FACADE, type CrmFacade, type PartyRole } from '../../crm/public/index.js';
import { PROJECTS_FACADE, type ProjectsFacade } from '../../projects/public/index.js';
import {
  BillRuleError,
  cancelTargets,
  canEditBill,
  canViewBill,
  canWriteKind,
  finalAmount,
  nextBillSituation,
  planInstallments,
  type BillCondition,
  type BillKind,
  type BillSituation,
  type CancelScope,
  type Frequency,
} from '../domain/bill-rules.js';
import {
  BILL_REPOSITORY,
  FINANCE_CATALOG_REPOSITORY,
  type BillData,
  type BillRecord,
  type BillRepository,
  type FinanceCatalogRepository,
  type NewBill,
  type PartyType,
  type SourceType,
} from '../repositories/finance.repository.js';

const ROLE_OF: Partial<Record<PartyType, PartyRole>> = {
  CLIENT: 'client',
  SUPPLIER: 'supplier',
  PROVIDER: 'provider',
  VEHICLE: 'vehicle',
};

const HISTORY_FIELDS = [
  'partyType', 'partyId', 'title', 'categoryId', 'accountId', 'paymentMethodId', 'amount',
  'additions', 'discounts', 'finalAmount', 'dueDate', 'competenceDate', 'billingDate',
  'documentNumber', 'referenceNumber', 'clientId', 'projectId', 'statusId', 'notes',
] as const;

export interface BillListQuery {
  kinds?: BillKind[];
  situations?: BillSituation[];
  /** AAAA-MM-DD; fim exclusivo. */
  from?: string;
  to?: string;
  search?: string;
  partyId?: string;
  clientId?: string;
  projectId?: string;
  accountId?: string;
  categoryId?: string;
  overdue?: boolean;
  limit: number;
  offset: number;
}

export interface BillInput {
  kind: BillKind;
  partyType: PartyType;
  partyId: string;
  title: string;
  categoryId: string;
  accountId: string;
  paymentMethodId: string;
  amount: number;
  additions?: number;
  discounts?: number;
  /** AAAA-MM-DD (1º vencimento, se parcelado). */
  dueDate: string;
  competenceDate?: string | null;
  billingDate?: string | null;
  condition?: BillCondition;
  count?: number;
  frequency?: Frequency;
  documentNumber?: string | null;
  referenceNumber?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  statusId?: string | null;
  notes?: string | null;
  /** Já entra quitado nesta data. */
  paidAt?: string | null;
}

export type BillChanges = Partial<Omit<BillInput, 'kind' | 'condition' | 'count' | 'frequency' | 'paidAt'>>;

export interface BillView extends BillRecord {
  party: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  project: { id: string; number: number; title: string } | null;
  overdue: boolean;
  can: { edit: boolean };
}

const toDate = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`Data inválida: ${value}.`);
  return new Date(`${value}T00:00:00.000Z`);
};

const todayUtcDate = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

/** Contas a pagar e a receber: lançamentos, parcelas, quitação e cancelamento. */
@Injectable()
export class BillsService {
  constructor(
    @Inject(BILL_REPOSITORY) private readonly bills: BillRepository,
    @Inject(FINANCE_CATALOG_REPOSITORY) private readonly catalog: FinanceCatalogRepository,
    @Inject(CRM_FACADE) private readonly crm: CrmFacade,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
  ) {}

  async list(
    userId: string,
    access: UserPermissions,
    query: BillListQuery,
  ): Promise<Page<BillView> & { totals: { revenue: number; expense: number } }> {
    const page = await this.bills.list({
      ...query,
      from: toDate(query.from) ?? undefined,
      to: toDate(query.to) ?? undefined,
      overdueAt: query.overdue ? todayUtcDate() : undefined,
      createdById: access.modules.financial >= READ_ALL ? undefined : userId,
    });
    return { total: page.total, totals: page.totals, items: await this.toViews(userId, access, page.items) };
  }

  async get(userId: string, access: UserPermissions, id: string): Promise<BillView & { group: BillView[] }> {
    const bill = await this.requireViewable(userId, access, id);
    const group = bill.installmentGroupId ? await this.bills.findGroup(bill.installmentGroupId) : [];
    const [view] = await this.toViews(userId, access, [bill]);
    return { ...view, group: await this.toViews(userId, access, group) };
  }

  async history(userId: string, access: UserPermissions, id: string) {
    await this.requireViewable(userId, access, id);
    return this.bills.listHistory(id);
  }

  /** Receita ou despesa, à vista, parcelada ou recorrente. */
  async create(userId: string, access: UserPermissions, input: BillInput): Promise<BillView[]> {
    if (!canWriteKind(access, input.kind)) {
      throw new ForbiddenException(input.kind === 'REVENUE' ? 'Sem permissão para lançar receitas.' : 'Sem permissão para lançar despesas.');
    }
    const condition = input.condition ?? 'SINGLE';
    const additions = input.additions ?? 0;
    const discounts = input.discounts ?? 0;
    if (condition !== 'SINGLE' && (additions > 0 || discounts > 0)) {
      throw new BadRequestException('Lançamento parcelado ou recorrente não aceita acréscimos nem descontos.');
    }
    const data = await this.validate(input.kind, {
      partyType: input.partyType,
      partyId: input.partyId,
      title: input.title,
      categoryId: input.categoryId,
      accountId: input.accountId,
      paymentMethodId: input.paymentMethodId,
      amount: input.amount,
      additions,
      discounts,
      dueDate: input.dueDate,
      competenceDate: input.competenceDate ?? null,
      billingDate: input.billingDate ?? null,
      documentNumber: input.documentNumber ?? null,
      referenceNumber: input.referenceNumber ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      statusId: input.statusId ?? null,
      notes: input.notes ?? null,
    });
    let plan;
    try {
      plan = planInstallments({
        amount: input.amount,
        condition,
        count: input.count,
        firstDueDate: input.dueDate,
        frequency: input.frequency,
      });
    } catch (error) {
      if (error instanceof BillRuleError) throw new BadRequestException(error.message);
      throw error;
    }
    const paidAt = toDate(input.paidAt) ?? null;
    if (paidAt && plan.length > 1) throw new BadRequestException('Quite as parcelas uma a uma.');
    const groupId = plan.length > 1 ? randomUUID() : null;
    const bills: NewBill[] = plan.map((installment) => ({
      ...data,
      kind: input.kind,
      amount: installment.amount,
      finalAmount: plan.length > 1 ? installment.amount : (data.finalAmount as number),
      dueDate: new Date(`${installment.dueDate}T00:00:00.000Z`),
      installmentGroupId: groupId,
      installmentNumber: installment.number,
      installmentCount: plan.length,
      condition,
      sourceType: 'MANUAL',
      sourceId: null,
      invoiceClass: null,
      situation: paidAt ? 'PAID' : 'OPEN',
      paidAt,
    }));
    return this.toViews(userId, access, await this.bills.createMany(bills, userId));
  }

  /**
   * Altera um lançamento em aberto. Fatura gerada por documento não muda de
   * pessoa, cliente nem projeto.
   */
  async update(userId: string, access: UserPermissions, id: string, changes: BillChanges): Promise<BillView> {
    const bill = await this.requireEditable(userId, access, id);
    if (bill.situation !== 'OPEN') throw new BadRequestException('Só lançamentos em aberto podem ser alterados.');
    if (bill.sourceType !== 'MANUAL') {
      for (const key of ['partyType', 'partyId', 'clientId', 'projectId'] as const) {
        if (changes[key] !== undefined && changes[key] !== bill[key]) {
          throw new BadRequestException('Fatura gerada por documento não muda de pessoa, cliente nem projeto.');
        }
      }
    }
    const merged = await this.validate(bill.kind, {
      partyType: changes.partyType ?? bill.partyType,
      partyId: changes.partyId ?? bill.partyId,
      title: changes.title ?? bill.title,
      categoryId: changes.categoryId ?? bill.categoryId,
      accountId: changes.accountId ?? bill.accountId,
      paymentMethodId: changes.paymentMethodId ?? bill.paymentMethodId,
      amount: changes.amount ?? bill.amount,
      additions: changes.additions ?? bill.additions,
      discounts: changes.discounts ?? bill.discounts,
      dueDate: changes.dueDate ?? bill.dueDate.toISOString().slice(0, 10),
      competenceDate: changes.competenceDate === undefined ? dateKey(bill.competenceDate) : changes.competenceDate,
      billingDate: changes.billingDate === undefined ? dateKey(bill.billingDate) : changes.billingDate,
      documentNumber: changes.documentNumber === undefined ? bill.documentNumber : changes.documentNumber,
      referenceNumber: changes.referenceNumber === undefined ? bill.referenceNumber : changes.referenceNumber,
      clientId: changes.clientId === undefined ? bill.clientId : changes.clientId,
      projectId: changes.projectId === undefined ? bill.projectId : changes.projectId,
      statusId: changes.statusId === undefined ? bill.statusId : changes.statusId,
      notes: changes.notes === undefined ? bill.notes : changes.notes,
    }, bill.sourceType !== 'MANUAL');
    if (bill.condition !== 'SINGLE' && (merged.additions > 0 || merged.discounts > 0)) {
      throw new BadRequestException('Parcela não aceita acréscimos nem descontos.');
    }
    const updated = await this.bills.update(id, merged, userId, diffFields(bill, merged, HISTORY_FIELDS));
    const [view] = await this.toViews(userId, access, [updated]);
    return view;
  }

  /** Quitar um ou vários (todos receita ou todos despesa), com a data de pagamento. */
  async settle(userId: string, access: UserPermissions, ids: string[], paidAt: string): Promise<void> {
    const date = toDate(paidAt);
    if (!date) throw new BadRequestException('Informe a data de pagamento.');
    const bills = await this.requireMany(userId, access, ids);
    if (new Set(bills.map((bill) => bill.kind)).size > 1) {
      throw new BadRequestException('Selecione só receitas ou só despesas para quitar juntas.');
    }
    if (bills.some((bill) => nextBillSituation(bill.situation, 'settle') === null)) {
      throw new BadRequestException('Só lançamentos em aberto podem ser quitados.');
    }
    await this.bills.setSituation(bills.map((bill) => bill.id), 'PAID', date, userId);
  }

  /** Cancela; no parcelado, só este, este e os próximos abertos, ou todos abertos. */
  async cancel(userId: string, access: UserPermissions, id: string, scope: CancelScope = 'this'): Promise<void> {
    const bill = await this.requireEditable(userId, access, id);
    if (bill.sourceType !== 'MANUAL') {
      throw new BadRequestException('Fatura gerada por documento: reabra o faturamento no documento de origem.');
    }
    if (bill.situation !== 'OPEN') throw new BadRequestException('Só lançamentos em aberto podem ser cancelados.');
    const group = bill.installmentGroupId ? await this.bills.findGroup(bill.installmentGroupId) : [bill];
    await this.bills.setSituation(cancelTargets(bill, group, scope), 'CANCELED', null, userId);
  }

  /** Reabre um lançamento quitado ou cancelado. */
  async reopen(userId: string, access: UserPermissions, id: string): Promise<void> {
    const bill = await this.requireEditable(userId, access, id);
    if (nextBillSituation(bill.situation, 'reopen') === null) throw new BadRequestException('O lançamento já está em aberto.');
    if (bill.sourceType !== 'MANUAL' && bill.situation === 'CANCELED') {
      throw new BadRequestException('Fatura de documento cancelada: envie de novo pelo documento de origem.');
    }
    await this.bills.setSituation([id], 'OPEN', null, userId);
  }

  private async requireViewable(userId: string, access: UserPermissions, id: string): Promise<BillRecord> {
    const bill = await this.bills.findById(id);
    if (!bill || !canViewBill(userId, access, bill)) throw new NotFoundException('Lançamento não encontrado.');
    return bill;
  }

  private async requireEditable(userId: string, access: UserPermissions, id: string): Promise<BillRecord> {
    const bill = await this.requireViewable(userId, access, id);
    if (!canEditBill(userId, access, bill)) throw new ForbiddenException('Sem permissão para alterar este lançamento.');
    return bill;
  }

  private async requireMany(userId: string, access: UserPermissions, ids: string[]): Promise<BillRecord[]> {
    const unique = [...new Set(ids)];
    const bills = await this.bills.findByIds(unique);
    if (bills.length !== unique.length || bills.some((bill) => !canViewBill(userId, access, bill))) {
      throw new NotFoundException('Lançamento não encontrado.');
    }
    if (bills.some((bill) => !canEditBill(userId, access, bill))) {
      throw new ForbiddenException('Sem permissão para alterar algum dos lançamentos.');
    }
    return bills;
  }

  /** Confere pessoa, categoria, conta, forma de pagamento, cliente e projeto. */
  private async validate(
    kind: BillKind,
    input: Omit<BillData, 'dueDate' | 'competenceDate' | 'billingDate' | 'finalAmount'> & {
      dueDate: string;
      competenceDate: string | null;
      billingDate: string | null;
    },
    trustedParty = false,
  ): Promise<BillData> {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título.');
    if (!trustedParty) await this.requireParty(input.partyType, input.partyId);
    const category = await this.catalog.findCategory(input.categoryId);
    if (!category || !category.active) throw new BadRequestException('Categoria não encontrada ou inativa.');
    if (category.kind !== kind) {
      throw new BadRequestException(kind === 'REVENUE' ? 'Escolha uma categoria de receita.' : 'Escolha uma categoria de despesa.');
    }
    const account = await this.catalog.findAccount(input.accountId);
    if (!account || !account.active) throw new BadRequestException('Conta não encontrada ou inativa.');
    const method = await this.catalog.findNamed('paymentMethod', input.paymentMethodId);
    if (!method || !method.active) throw new BadRequestException('Forma de pagamento não encontrada ou inativa.');
    if (input.statusId && !(await this.catalog.findStatus(input.statusId))) throw new BadRequestException('Status não encontrado.');
    if (input.clientId && !trustedParty) {
      const client = await this.crm.getParty(input.clientId);
      if (!client || !client.roles.includes('client')) throw new BadRequestException('Cliente não encontrado.');
    }
    if (input.projectId && !trustedParty) {
      const project = await this.projects.getProject(input.projectId);
      if (!project) throw new BadRequestException('Projeto não encontrado.');
      if (input.clientId && project.clientId !== input.clientId) {
        throw new BadRequestException('O projeto é de outro cliente.');
      }
    }
    let total: number;
    try {
      total = finalAmount(input.amount, input.additions, input.discounts);
    } catch (error) {
      if (error instanceof BillRuleError) throw new BadRequestException(error.message);
      throw error;
    }
    return {
      ...input,
      title,
      documentNumber: input.documentNumber?.trim() || null,
      referenceNumber: input.referenceNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      finalAmount: total,
      dueDate: toDate(input.dueDate) as Date,
      competenceDate: toDate(input.competenceDate) ?? null,
      billingDate: toDate(input.billingDate) ?? null,
    };
  }

  private async requireParty(type: PartyType, id: string): Promise<void> {
    if (type === 'COLLABORATOR') {
      const [collaborator] = await this.auth.getCollaboratorNames([id]);
      if (!collaborator || !collaborator.active) throw new BadRequestException('Colaborador não encontrado ou inativo.');
      return;
    }
    const party = await this.crm.getParty(id);
    if (!party || !party.active || !party.roles.includes(ROLE_OF[type]!)) {
      throw new BadRequestException('Pessoa não encontrada ou sem este papel.');
    }
  }

  private async toViews(userId: string, access: UserPermissions, bills: BillRecord[]): Promise<BillView[]> {
    if (bills.length === 0) return [];
    const partyIds = bills.filter((bill) => bill.partyType !== 'COLLABORATOR').map((bill) => bill.partyId);
    const clientIds = bills.map((bill) => bill.clientId).filter((id): id is string => Boolean(id));
    const collaboratorIds = bills.filter((bill) => bill.partyType === 'COLLABORATOR').map((bill) => bill.partyId);
    const [parties, collaborators, projects] = await Promise.all([
      this.crm.getParties([...partyIds, ...clientIds]),
      this.auth.getCollaboratorNames([...new Set(collaboratorIds)]),
      this.projects.getProjects(bills.map((bill) => bill.projectId).filter((id): id is string => Boolean(id))),
    ]);
    const names = new Map([...parties, ...collaborators].map((item) => [item.id, { id: item.id, name: item.name }]));
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const today = todayUtcDate();
    return bills.map((bill) => {
      const project = bill.projectId ? projectMap.get(bill.projectId) : undefined;
      return {
        ...bill,
        party: names.get(bill.partyId) ?? null,
        client: bill.clientId ? (names.get(bill.clientId) ?? null) : null,
        project: project ? { id: project.id, number: project.number, title: project.title } : null,
        overdue: bill.situation === 'OPEN' && bill.dueDate < today,
        can: { edit: canEditBill(userId, access, bill) },
      };
    });
  }
}

function dateKey(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export type { SourceType };
