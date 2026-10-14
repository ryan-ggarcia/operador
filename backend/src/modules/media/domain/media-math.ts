import {
  amountOf,
  fromCents,
  toCents,
  type ValueType,
} from '../../../shared/money/money.js';

/**
 * Contas da grade e do faturamento de mídia, iguais às do Operand
 * (docs/operand/midia.md, 2.8). Tudo em centavos por dentro; a saída volta
 * em reais com duas casas.
 */

export class MediaMathError extends Error {}

export interface LineValues {
  quantity: number;
  unitValue: number;
  discountType: ValueType;
  discountValue: number;
  isBonus: boolean;
}

/**
 * Total da linha = quantidade × unitário − desconto (% sobre esse produto ou
 * valor fixo da linha inteira). O desconto não pode deixar o total negativo.
 */
export function lineSubtotalCents(line: LineValues): { grossCents: number; discountCents: number; subtotalCents: number } {
  if (line.quantity < 0 || line.unitValue < 0 || line.discountValue < 0) {
    throw new MediaMathError('Quantidade, valor e desconto não podem ser negativos.');
  }
  const grossCents = Math.round(line.quantity * line.unitValue * 100);
  if (grossCents === 0) return { grossCents: 0, discountCents: 0, subtotalCents: 0 };
  const discountCents = amountOf(grossCents, line.discountType, line.discountValue);
  if (discountCents > grossCents) {
    throw new MediaMathError('O desconto da linha não pode passar do valor dela.');
  }
  return { grossCents, discountCents, subtotalCents: grossCents - discountCents };
}

export function lineSubtotal(line: LineValues): number {
  return fromCents(lineSubtotalCents(line).subtotalCents);
}

export interface GridTotals {
  /** Linhas não bonificadas, antes do desconto. */
  gross: number;
  discount: number;
  /** Linhas bonificadas: não entram no valor. */
  bonus: number;
  /** Valor da grade (linhas não bonificadas, com desconto). */
  total: number;
  insertions: number;
}

export function gridTotals(lines: LineValues[]): GridTotals {
  let gross = 0;
  let discount = 0;
  let bonus = 0;
  let insertions = 0;
  for (const line of lines) {
    const values = lineSubtotalCents(line);
    insertions += line.quantity;
    if (line.isBonus) {
      bonus += values.subtotalCents;
    } else {
      gross += values.grossCents;
      discount += values.discountCents;
    }
  }
  return {
    gross: fromCents(gross),
    discount: fromCents(discount),
    bonus: fromCents(bonus),
    total: fromCents(gross - discount),
    insertions,
  };
}

export interface MediaTerms {
  generalDiscountType: ValueType;
  generalDiscountValue: number;
  commissionType: ValueType;
  commissionValue: number;
  /** Mesmo tipo da comissão; nulo = sem negociação. */
  negotiatedCommission: number | null;
  feeType: ValueType;
  feeValue: number;
}

export interface MediaTotals {
  /** Soma das grades, antes do desconto geral. */
  gridsTotal: number;
  bonusTotal: number;
  generalDiscount: number;
  /** Valor total da mídia (já com o desconto geral). */
  total: number;
  /** Comissão da agência (padrão). */
  commission: number;
  /** O que o veículo recebe: total − comissão. */
  net: number;
  /** O que a agência cobra de comissão: a negociada, se houver. */
  partial: number;
  /** Honorários da agência. */
  fee: number;
}

export function mediaTotals(grids: GridTotals[], terms: MediaTerms): MediaTotals {
  const gridsCents = grids.reduce((sum, grid) => sum + toCents(grid.total), 0);
  const bonusCents = grids.reduce((sum, grid) => sum + toCents(grid.bonus), 0);
  const discountCents = amountOf(gridsCents, terms.generalDiscountType, terms.generalDiscountValue);
  if (discountCents > gridsCents) throw new MediaMathError('O desconto geral não pode passar do valor da mídia.');
  const totalCents = gridsCents - discountCents;
  const commissionCents = amountOf(totalCents, terms.commissionType, terms.commissionValue);
  if (commissionCents > totalCents) throw new MediaMathError('A comissão não pode passar do valor total da mídia.');
  const partialCents =
    terms.negotiatedCommission == null
      ? commissionCents
      : amountOf(totalCents, terms.commissionType, terms.negotiatedCommission);
  if (partialCents > commissionCents) {
    throw new MediaMathError('A comissão negociada não pode ser maior que a comissão.');
  }
  return {
    gridsTotal: fromCents(gridsCents),
    bonusTotal: fromCents(bonusCents),
    generalDiscount: fromCents(discountCents),
    total: fromCents(totalCents),
    commission: fromCents(commissionCents),
    net: fromCents(totalCents - commissionCents),
    partial: fromCents(partialCents),
    fee: fromCents(amountOf(totalCents, terms.feeType, terms.feeValue)),
  };
}

export type BillingType = 'FLCC' | 'FBCC' | 'FLCA' | 'FL_CCA' | 'FBCA';

/** Classes de fatura (as de terceiro → cliente não entram no financeiro). */
export type InvoiceClass =
  | 'THIRD_PARTY_RECEIVES_NET_CLIENT'
  | 'THIRD_PARTY_RECEIVES_TOTAL_CLIENT'
  | 'AGENCY_RECEIVES_COMMISSION_CLIENT'
  | 'AGENCY_RECEIVES_COMMISSION_THIRD_PARTY'
  | 'AGENCY_RECEIVES_NET_CLIENT'
  | 'AGENCY_RECEIVES_TOTAL_CLIENT'
  | 'AGENCY_PAYS_NET_THIRD_PARTY'
  | 'AGENCY_PAYS_TOTAL_THIRD_PARTY'
  | 'FEE';

export type Party = 'client' | 'agency' | 'thirdParty';

export interface PlannedInvoice {
  invoiceClass: InvoiceClass;
  payer: Party;
  payee: Party;
  amount: number;
  /** Receita ou despesa da agência; nulo = só informação (terceiro fatura o cliente). */
  kind: 'REVENUE' | 'EXPENSE' | null;
}

export const BILLING_TYPES: Record<BillingType, string> = {
  FLCC: 'Faturar líquido contra o cliente',
  FBCC: 'Faturar bruto contra o cliente',
  FLCA: 'Faturar líquido contra a agência',
  FL_CCA: 'Faturar líquido + comissão contra a agência',
  FBCA: 'Faturar bruto contra a agência',
};

const INVOICE: Record<InvoiceClass, Omit<PlannedInvoice, 'amount' | 'invoiceClass'>> = {
  THIRD_PARTY_RECEIVES_NET_CLIENT: { payer: 'client', payee: 'thirdParty', kind: null },
  THIRD_PARTY_RECEIVES_TOTAL_CLIENT: { payer: 'client', payee: 'thirdParty', kind: null },
  AGENCY_RECEIVES_COMMISSION_CLIENT: { payer: 'client', payee: 'agency', kind: 'REVENUE' },
  AGENCY_RECEIVES_COMMISSION_THIRD_PARTY: { payer: 'thirdParty', payee: 'agency', kind: 'REVENUE' },
  AGENCY_RECEIVES_NET_CLIENT: { payer: 'client', payee: 'agency', kind: 'REVENUE' },
  AGENCY_RECEIVES_TOTAL_CLIENT: { payer: 'client', payee: 'agency', kind: 'REVENUE' },
  AGENCY_PAYS_NET_THIRD_PARTY: { payer: 'agency', payee: 'thirdParty', kind: 'EXPENSE' },
  AGENCY_PAYS_TOTAL_THIRD_PARTY: { payer: 'agency', payee: 'thirdParty', kind: 'EXPENSE' },
  FEE: { payer: 'client', payee: 'agency', kind: 'REVENUE' },
};

/** Nos tipos "bruto", a comissão vem do veículo: não há comissão negociada. */
export function allowsNegotiatedCommission(type: BillingType): boolean {
  return type !== 'FBCC' && type !== 'FBCA';
}

/**
 * Faturas que o tipo de faturamento gera. Faturas de valor zero não nascem;
 * os honorários são sempre "agência recebe do cliente".
 */
export function billingPlan(type: BillingType, totals: MediaTotals, hasNegotiation: boolean): PlannedInvoice[] {
  if (hasNegotiation && !allowsNegotiatedCommission(type)) {
    throw new MediaMathError('Comissão negociada não vale nos tipos de faturamento bruto (FBCC e FBCA).');
  }
  const parts: [InvoiceClass, number][] = {
    FLCC: [
      ['THIRD_PARTY_RECEIVES_NET_CLIENT', totals.net],
      ['AGENCY_RECEIVES_COMMISSION_CLIENT', totals.partial],
    ],
    FBCC: [
      ['THIRD_PARTY_RECEIVES_TOTAL_CLIENT', totals.total],
      ['AGENCY_RECEIVES_COMMISSION_THIRD_PARTY', totals.commission],
    ],
    FLCA: [
      ['AGENCY_RECEIVES_COMMISSION_CLIENT', totals.partial],
      ['AGENCY_PAYS_NET_THIRD_PARTY', totals.net],
    ],
    FL_CCA: [
      ['AGENCY_RECEIVES_COMMISSION_CLIENT', totals.partial],
      ['AGENCY_RECEIVES_NET_CLIENT', totals.net],
      ['AGENCY_PAYS_NET_THIRD_PARTY', totals.net],
    ],
    FBCA: [
      ['AGENCY_RECEIVES_TOTAL_CLIENT', totals.total],
      ['AGENCY_PAYS_TOTAL_THIRD_PARTY', totals.total],
      ['AGENCY_RECEIVES_COMMISSION_THIRD_PARTY', totals.commission],
    ],
  }[type] as [InvoiceClass, number][];
  parts.push(['FEE', totals.fee]);
  return parts
    .filter(([, amount]) => amount > 0)
    .map(([invoiceClass, amount]) => ({ invoiceClass, amount, ...INVOICE[invoiceClass] }));
}

/** AAAA-MM-DD → dia da semana (0 = domingo). */
function weekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/**
 * TV e rádio: inserções por dia, só nos dias em que o programa vai ao ar e
 * dentro do período da grade. Devolve a quantidade (soma do calendário).
 */
export function dailyInsertionsQuantity(
  daily: Record<string, number>,
  airingDays: number[],
  period: { start: string | null; end: string | null },
): number {
  let total = 0;
  for (const [date, count] of Object.entries(daily)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new MediaMathError(`Data inválida no calendário: ${date}.`);
    if (!Number.isInteger(count) || count < 0) throw new MediaMathError('Inserções por dia precisam ser inteiras.');
    if (count === 0) continue;
    if ((period.start && date < period.start) || (period.end && date > period.end)) {
      throw new MediaMathError(`O dia ${date} está fora do período da grade.`);
    }
    if (!airingDays.includes(weekday(date))) {
      throw new MediaMathError(`O programa não vai ao ar em ${date}.`);
    }
    total += count;
  }
  return total;
}

/** Externa (OOH): bi-semanas numeradas; a inicial não pode passar da final. */
export function biweeksQuantity(biweeks: number[]): number {
  const unique = [...new Set(biweeks)];
  if (unique.some((value) => !Number.isInteger(value) || value < 1 || value > 26)) {
    throw new MediaMathError('Bi-semana inválida (1 a 26).');
  }
  return unique.length;
}
