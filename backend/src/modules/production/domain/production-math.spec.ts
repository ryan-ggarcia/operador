import { billingPlan } from '../../finance/public/billing.js';
import { normalizeQuantities, orderTotals, quoteValues } from './production-math.js';

const noTerms = { commissionType: 'PERCENT' as const, commissionValue: 0, feeType: 'PERCENT' as const, feeValue: 0 };

describe('cotação', () => {
  it('quantidades positivas, sem repetir, em ordem', () => {
    expect(normalizeQuantities([1000, 500, 2000])).toEqual([500, 1000, 2000]);
    expect(() => normalizeQuantities([])).toThrow(/pelo menos uma/);
    expect(() => normalizeQuantities([500, 500])).toThrow(/repetidas/);
    expect(() => normalizeQuantities([0])).toThrow(/maior que zero/);
  });

  it('total = quantidade × unitário; BV e honorários sobre o total', () => {
    expect(quoteValues(1000, 0.35, noTerms)).toEqual({ total: 350, commission: 0, fee: 0 });
    expect(quoteValues(500, 1.234567, { ...noTerms, commissionValue: 10, feeType: 'AMOUNT', feeValue: 50 })).toEqual({
      total: 617.28,
      commission: 61.73,
      fee: 50,
    });
  });
});

describe('pedido de produção', () => {
  const quotes = [
    { total: 1000, commission: 100, fee: 0 },
    { total: 500, commission: 50, fee: 20 },
  ];

  it('subtotal, desconto, BV, líquido e encargo', () => {
    expect(orderTotals({ quotes, discount: 100, negotiatedCommission: null, taxPercent: 5 })).toEqual({
      subtotal: 1500,
      discount: 100,
      total: 1400,
      commission: 150,
      partial: 150,
      net: 1250,
      fee: 20,
      tax: 70,
      valueToPass: 1250,
    });
  });

  it('comissão negociada e limites', () => {
    expect(orderTotals({ quotes, discount: 0, negotiatedCommission: 60, taxPercent: 0 }).partial).toBe(60);
    expect(() => orderTotals({ quotes, discount: 2000, negotiatedCommission: null, taxPercent: 0 })).toThrow(/desconto/);
    expect(() => orderTotals({ quotes, discount: 0, negotiatedCommission: 200, taxPercent: 0 })).toThrow(/negociada/);
    expect(() => orderTotals({ quotes: [{ total: 100, commission: 150, fee: 0 }], discount: 0, negotiatedCommission: null, taxPercent: 0 })).toThrow(/BV/);
  });

  it('usa o mesmo plano de faturas da mídia: FBCC sem BV gera só a fatura do fornecedor', () => {
    const totals = orderTotals({ quotes: [{ total: 800, commission: 0, fee: 0 }], discount: 0, negotiatedCommission: null, taxPercent: 0 });
    expect(billingPlan('FBCC', totals, false).map((invoice) => [invoice.invoiceClass, invoice.amount])).toEqual([
      ['THIRD_PARTY_RECEIVES_TOTAL_CLIENT', 800],
    ]);
    expect(billingPlan('FLCA', totals, false).map((invoice) => [invoice.invoiceClass, invoice.kind])).toEqual([
      ['AGENCY_PAYS_NET_THIRD_PARTY', 'EXPENSE'],
    ]);
  });
});
