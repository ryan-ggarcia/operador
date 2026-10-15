/**
 * Faturamento de terceiros (mídia e produção), igual ao Operand
 * (docs/operand/midia.md, 2.8): que faturas cada tipo de faturamento gera.
 * Funções puras, usadas pelos módulos que enviam documentos ao financeiro.
 */

export class BillingError extends Error {}

/** Valores que entram no plano de faturas. */
export interface BillingAmounts {
  /** Valor total (bruto) do documento. */
  total: number;
  /** O que o terceiro recebe: total − comissão. */
  net: number;
  /** Comissão padrão (BV, na produção). */
  commission: number;
  /** Comissão que a agência cobra (a negociada, se houver). */
  partial: number;
  /** Honorários da agência. */
  fee: number;
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
export function billingPlan(type: BillingType, totals: BillingAmounts, hasNegotiation: boolean): PlannedInvoice[] {
  if (hasNegotiation && !allowsNegotiatedCommission(type)) {
    throw new BillingError('Comissão negociada não vale nos tipos de faturamento bruto (FBCC e FBCA).');
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

