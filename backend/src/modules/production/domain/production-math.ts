import { amountOf, fromCents, percentOf, toCents, type ValueType } from '../../../shared/money/money.js';

/**
 * Contas da cotação (EC) e do pedido de produção (PP), iguais às do Operand
 * (docs/operand/producao.md, 2.9). Centavos por dentro, reais na saída.
 */

export class ProductionMathError extends Error {}

/** Quantidades do item: pelo menos uma, positivas e sem repetir. */
export function normalizeQuantities(quantities: number[]): number[] {
  if (quantities.length === 0) throw new ProductionMathError('Informe pelo menos uma quantidade.');
  if (quantities.some((quantity) => !(quantity > 0))) throw new ProductionMathError('Quantidade precisa ser maior que zero.');
  const unique = [...new Set(quantities.map((quantity) => Number(quantity.toFixed(4))))];
  if (unique.length !== quantities.length) throw new ProductionMathError('Há quantidades repetidas.');
  return unique.sort((a, b) => a - b);
}

export interface ItemTerms {
  commissionType: ValueType;
  commissionValue: number;
  feeType: ValueType;
  feeValue: number;
}

export interface QuoteValues {
  total: number;
  /** Comissão do fornecedor à agência (BV). */
  commission: number;
  fee: number;
}

/** Cotação: total = quantidade × unitário; BV e honorários do item sobre o total. */
export function quoteValues(quantity: number, unitValue: number, terms: ItemTerms): QuoteValues {
  if (quantity <= 0 || unitValue < 0) throw new ProductionMathError('Quantidade e valor precisam ser positivos.');
  const totalCents = Math.round(quantity * unitValue * 100);
  return {
    total: fromCents(totalCents),
    commission: fromCents(totalCents === 0 ? 0 : amountOf(totalCents, terms.commissionType, terms.commissionValue)),
    fee: fromCents(totalCents === 0 ? 0 : amountOf(totalCents, terms.feeType, terms.feeValue)),
  };
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  total: number;
  commission: number;
  /** BV que a agência cobra (a negociada, se houver). */
  partial: number;
  /** O que o fornecedor recebe: total − comissão. */
  net: number;
  fee: number;
  /** Encargo sobre o total (informativo no pedido). */
  tax: number;
  valueToPass: number;
}

/** Pedido de um fornecedor: soma as cotações aprovadas dos itens dele. */
export function orderTotals(input: {
  quotes: QuoteValues[];
  discount: number;
  negotiatedCommission: number | null;
  taxPercent: number;
}): OrderTotals {
  const subtotal = input.quotes.reduce((sum, quote) => sum + toCents(quote.total), 0);
  const discount = toCents(input.discount);
  if (discount < 0 || discount > subtotal) throw new ProductionMathError('O desconto não pode passar do subtotal.');
  const total = subtotal - discount;
  const commission = input.quotes.reduce((sum, quote) => sum + toCents(quote.commission), 0);
  if (commission > total) throw new ProductionMathError('A comissão (BV) não pode passar do valor total do pedido.');
  const partial = input.negotiatedCommission == null ? commission : toCents(input.negotiatedCommission);
  if (partial < 0 || partial > commission) throw new ProductionMathError('A comissão negociada não pode ser maior que a comissão.');
  const fee = input.quotes.reduce((sum, quote) => sum + toCents(quote.fee), 0);
  return {
    subtotal: fromCents(subtotal),
    discount: fromCents(discount),
    total: fromCents(total),
    commission: fromCents(commission),
    partial: fromCents(partial),
    net: fromCents(total - commission),
    fee: fromCents(fee),
    tax: fromCents(percentOf(total, input.taxPercent)),
    valueToPass: fromCents(total - commission),
  };
}
