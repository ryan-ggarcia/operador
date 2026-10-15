import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fromCents, toCents } from '../../../shared/money/money.js';
import { localDate } from '../../../shared/time/timezone.js';
import { READ_ALL, type UserPermissions } from '../../auth/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import { canTransfer, type BillKind } from '../domain/bill-rules.js';
import {
  BILL_REPOSITORY,
  FINANCE_CATALOG_REPOSITORY,
  type AccountRecord,
  type BillRepository,
  type CatalogTable,
  type CategoryRecord,
  type FinanceCatalogRepository,
  type NamedRecord,
  type TransferRecord,
} from '../repositories/finance.repository.js';

const day = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`Data inválida: ${value}.`);
  return new Date(`${value}T00:00:00.000Z`);
};

export interface AccountBalance extends AccountRecord {
  /** Saldo inicial + quitados + transferências até hoje. */
  balance: number;
}

/** Contas, saldos, transferências, resumo do período e cadastros do financeiro. */
@Injectable()
export class TreasuryService {
  constructor(
    @Inject(BILL_REPOSITORY) private readonly bills: BillRepository,
    @Inject(FINANCE_CATALOG_REPOSITORY) private readonly catalog: FinanceCatalogRepository,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
  ) {}

  private async today(): Promise<string> {
    const { timezone } = await this.settings.getAgency();
    return localDate(new Date(), timezone);
  }

  /** Resumo do período: recebido × a receber, pago × a pagar, transferências e saldo. */
  async summary(userId: string, access: UserPermissions, from: string, to: string) {
    const start = day(from);
    const end = day(to);
    if (end <= start) throw new BadRequestException('O fim do período precisa ser depois do início.');
    const [totals, transfers] = await Promise.all([
      this.bills.summary(start, end, access.modules.financial >= READ_ALL ? undefined : userId),
      this.bills.listTransfers(start, end),
    ]);
    const realized = toCents(totals.revenuePaid) - toCents(totals.expensePaid);
    const forecast = realized + toCents(totals.revenueOpen) - toCents(totals.expenseOpen);
    return {
      ...totals,
      transfers: fromCents(transfers.reduce((sum, transfer) => sum + toCents(transfer.amount), 0)),
      realizedBalance: fromCents(realized),
      forecastBalance: fromCents(forecast),
    };
  }

  async balances(): Promise<AccountBalance[]> {
    const until = day(await this.today());
    until.setUTCDate(until.getUTCDate() + 1);
    const [accounts, paid, transfers] = await Promise.all([
      this.catalog.listAccounts(),
      this.bills.paidByAccount(until),
      this.bills.transfersByAccount(until),
    ]);
    return accounts.map((account) => {
      const bills = paid.find((item) => item.accountId === account.id);
      const moves = transfers.find((item) => item.accountId === account.id);
      const cents =
        toCents(account.initialBalance) +
        toCents(bills?.revenue ?? 0) -
        toCents(bills?.expense ?? 0) +
        toCents(moves?.incoming ?? 0) -
        toCents(moves?.outgoing ?? 0);
      return { ...account, balance: fromCents(cents) };
    });
  }

  listTransfers(from?: string, to?: string): Promise<TransferRecord[]> {
    return this.bills.listTransfers(from ? day(from) : undefined, to ? day(to) : undefined);
  }

  /** Transferência entre contas diferentes; com data futura, fica agendada. */
  async createTransfer(
    userId: string,
    access: UserPermissions,
    input: { title: string; fromAccountId: string; toAccountId: string; date: string; amount: number },
  ): Promise<TransferRecord> {
    if (!canTransfer(access)) throw new ForbiddenException('Sem permissão para transferências.');
    if (input.fromAccountId === input.toAccountId) throw new BadRequestException('Escolha contas diferentes.');
    if (toCents(input.amount) <= 0) throw new BadRequestException('O valor precisa ser maior que zero.');
    for (const id of [input.fromAccountId, input.toAccountId]) {
      const account = await this.catalog.findAccount(id);
      if (!account || !account.active) throw new BadRequestException('Conta não encontrada ou inativa.');
    }
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título.');
    return this.bills.createTransfer(
      {
        title,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        date: day(input.date),
        amount: input.amount,
        scheduled: input.date > (await this.today()),
      },
      userId,
    );
  }

  async removeTransfer(access: UserPermissions, id: string): Promise<void> {
    if (!canTransfer(access)) throw new ForbiddenException('Sem permissão para transferências.');
    if (!(await this.bills.findTransfer(id))) throw new NotFoundException('Transferência não encontrada.');
    await this.bills.deleteTransfer(id);
  }

  // ---------- Cadastros ----------

  listCategories(): Promise<CategoryRecord[]> {
    return this.catalog.listCategories();
  }

  /** Plano de contas em árvore: a subcategoria é do mesmo tipo da mãe. */
  async saveCategory(
    id: string | null,
    input: { name: string; kind: BillKind; parentId: string | null; active: boolean },
  ): Promise<CategoryRecord> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Informe o nome da categoria.');
    const current = id ? await this.catalog.findCategory(id) : null;
    if (id && !current) throw new NotFoundException('Categoria não encontrada.');
    if (current && current.kind !== input.kind && (await this.catalog.categoryInUse(id!))) {
      throw new BadRequestException('A categoria tem lançamentos: não muda de receita para despesa.');
    }
    if (input.parentId) {
      if (input.parentId === id) throw new BadRequestException('A categoria não pode ser mãe dela mesma.');
      const parent = await this.catalog.findCategory(input.parentId);
      if (!parent) throw new BadRequestException('Categoria mãe não encontrada.');
      if (parent.kind !== input.kind) throw new BadRequestException('A subcategoria precisa ser do mesmo tipo da mãe.');
    }
    return this.catalog.saveCategory(id, { ...input, name });
  }

  listAccounts(): Promise<AccountBalance[]> {
    return this.balances();
  }

  /** A conta padrão não pode ser inativada. */
  async saveAccount(
    id: string | null,
    input: Omit<AccountRecord, 'id' | 'isDefault'> & { isDefault?: boolean },
  ): Promise<AccountRecord> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Informe o nome da conta.');
    const current = id ? await this.catalog.findAccount(id) : null;
    if (id && !current) throw new NotFoundException('Conta não encontrada.');
    if (current?.isDefault && !input.active) throw new BadRequestException('A conta padrão não pode ser inativada.');
    const { isDefault, ...data } = input;
    const saved = await this.catalog.saveAccount(id, { ...data, name });
    if (isDefault && !saved.isDefault) await this.catalog.makeDefaultAccount(saved.id);
    return (await this.catalog.findAccount(saved.id))!;
  }

  listNamed(table: CatalogTable): Promise<NamedRecord[]> {
    return this.catalog.listNamed(table);
  }

  /** A forma de pagamento padrão não pode ser inativada. */
  async saveNamed(table: CatalogTable, id: string | null, input: { name: string; active: boolean }): Promise<NamedRecord> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Informe o nome.');
    const current = id ? await this.catalog.findNamed(table, id) : null;
    if (id && !current) throw new NotFoundException('Cadastro não encontrado.');
    if (current?.isDefault && !input.active) throw new BadRequestException('A opção padrão não pode ser inativada.');
    const existing = await this.catalog.listNamed(table);
    if (existing.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) {
      throw new ConflictException('Já existe um cadastro com este nome.');
    }
    return this.catalog.saveNamed(table, id, { name, active: input.active });
  }

  listStatuses() {
    return this.catalog.listStatuses();
  }
}
