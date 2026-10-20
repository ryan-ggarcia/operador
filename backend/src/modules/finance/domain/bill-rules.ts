import { canEditOwn, FULL, READ_ALL, type UserPermissions } from '../../auth/public/index.js';
import { fromCents, splitCents, toCents } from '../../../shared/money/money.js';

/** Regras de lançamentos (docs/operand/financeiro.md, 4 e 5). */

export class BillRuleError extends Error {}

export type BillKind = 'REVENUE' | 'EXPENSE';
export type BillSituation = 'OPEN' | 'PAID' | 'CANCELED';
export type BillCondition = 'SINGLE' | 'INSTALLMENTS' | 'RECURRING';
export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';

export const MAX_INSTALLMENTS = 120;

/** AAAA-MM-DD + meses, sem pular de mês (31/01 + 1 mês = 28/02). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function step(date: string, frequency: Frequency, index: number): string {
  switch (frequency) {
    case 'WEEKLY':
      return addDays(date, 7 * index);
    case 'BIWEEKLY':
      return addDays(date, 15 * index);
    case 'MONTHLY':
      return addMonths(date, index);
    case 'QUARTERLY':
      return addMonths(date, 3 * index);
    case 'SEMIANNUAL':
      return addMonths(date, 6 * index);
    case 'YEARLY':
      return addMonths(date, 12 * index);
  }
}

export interface PlannedInstallment {
  number: number;
  dueDate: string;
  amount: number;
}

/**
 * Parcelas do lançamento a partir do 1º vencimento:
 * - à vista: uma parcela;
 * - parcelado: divide o valor em partes iguais (a sobra dos centavos vai para
 *   a última), no mínimo 2 parcelas, mensais por padrão;
 * - recorrente: repete o valor cheio na frequência escolhida.
 */
export function planInstallments(input: {
  amount: number;
  condition: BillCondition;
  count?: number;
  firstDueDate: string;
  frequency?: Frequency;
}): PlannedInstallment[] {
  const cents = toCents(input.amount);
  if (cents <= 0) throw new BillRuleError('O valor precisa ser maior que zero.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.firstDueDate)) throw new BillRuleError('Vencimento inválido.');
  if (input.condition === 'SINGLE') {
    return [{ number: 1, dueDate: input.firstDueDate, amount: fromCents(cents) }];
  }
  const count = input.count ?? 0;
  if (!Number.isInteger(count) || count < 2) throw new BillRuleError('Informe pelo menos 2 parcelas.');
  if (count > MAX_INSTALLMENTS) throw new BillRuleError(`No máximo ${MAX_INSTALLMENTS} parcelas.`);
  const frequency = input.frequency ?? 'MONTHLY';
  const values =
    input.condition === 'INSTALLMENTS' ? splitCents(cents, count) : Array.from({ length: count }, () => cents);
  if (values.some((value) => value <= 0)) throw new BillRuleError('Valor pequeno demais para tantas parcelas.');
  return values.map((value, index) => ({
    number: index + 1,
    dueDate: step(input.firstDueDate, frequency, index),
    amount: fromCents(value),
  }));
}

/** Valor final = valor + acréscimos − descontos; o desconto não passa do valor. */
export function finalAmount(amount: number, additions: number, discounts: number): number {
  if (amount <= 0) throw new BillRuleError('O valor precisa ser maior que zero.');
  if (additions < 0 || discounts < 0) throw new BillRuleError('Acréscimos e descontos não podem ser negativos.');
  const total = toCents(amount) + toCents(additions);
  if (toCents(discounts) > total) throw new BillRuleError('O desconto não pode passar do valor.');
  return fromCents(total - toCents(discounts));
}

export function nextBillSituation(
  current: BillSituation,
  action: 'settle' | 'cancel' | 'reopen',
): BillSituation | null {
  if (action === 'reopen') return current === 'OPEN' ? null : 'OPEN';
  if (current !== 'OPEN') return null;
  return action === 'settle' ? 'PAID' : 'CANCELED';
}

export type CancelScope = 'this' | 'next' | 'all';

/** Parcelas atingidas ao cancelar: só esta, esta e as próximas abertas, ou todas abertas. */
export function cancelTargets(
  bill: { id: string; installmentNumber: number },
  group: { id: string; installmentNumber: number; situation: BillSituation }[],
  scope: CancelScope,
): string[] {
  if (scope === 'this') return [bill.id];
  return group
    .filter((item) => item.situation === 'OPEN' || item.id === bill.id)
    .filter((item) => scope === 'all' || item.installmentNumber >= bill.installmentNumber)
    .map((item) => item.id);
}

export interface BillAccessView {
  kind: BillKind;
  createdById: string | null;
}

/** Nível 1 vê só os lançamentos que criou; 2 ou mais vê todos. */
export function canViewBill(userId: string, access: UserPermissions, bill: BillAccessView): boolean {
  const level = access.modules.financial;
  if (level === 0) return false;
  return level >= READ_ALL || bill.createdById === userId;
}

/** Lançar receita ou despesa exige a permissão do tipo, além do nível. */
export function canWriteKind(access: UserPermissions, kind: BillKind): boolean {
  if (!canEditOwn(access.modules.financial)) return false;
  return kind === 'REVENUE' ? access.flags.financialRevenues : access.flags.financialExpenses;
}

export function canEditBill(userId: string, access: UserPermissions, bill: BillAccessView): boolean {
  if (!canWriteKind(access, bill.kind)) return false;
  return access.modules.financial >= FULL || bill.createdById === userId;
}

export function canTransfer(access: UserPermissions): boolean {
  return canEditOwn(access.modules.financial) && access.flags.financialTransfers;
}
