/** Dinheiro em centavos inteiros, para as contas não acumularem erro. */

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Percentual (ex.: 20 = 20%) de um valor em centavos, arredondado. */
export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

export type ValueType = 'PERCENT' | 'AMOUNT';

/** Valor de um campo que pode ser % ou valor fixo, sobre uma base. */
export function amountOf(baseCents: number, type: ValueType, value: number): number {
  return type === 'PERCENT' ? percentOf(baseCents, value) : toCents(value);
}

/**
 * Divide um valor em parcelas iguais; a diferença do arredondamento vai para
 * a última parcela (a soma sempre bate).
 */
export function splitCents(totalCents: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) throw new Error('Número de parcelas inválido.');
  const base = Math.floor(totalCents / parts);
  const result = Array.from({ length: parts }, () => base);
  result[parts - 1] += totalCents - base * parts;
  return result;
}
