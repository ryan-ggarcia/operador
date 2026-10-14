import {
  allowsNegotiatedCommission,
  billingPlan,
  biweeksQuantity,
  dailyInsertionsQuantity,
  gridTotals,
  lineSubtotal,
  mediaTotals,
  type LineValues,
  type MediaTerms,
} from './media-math.js';

const line = (overrides: Partial<LineValues> = {}): LineValues => ({
  quantity: 10,
  unitValue: 150,
  discountType: 'PERCENT',
  discountValue: 0,
  isBonus: false,
  ...overrides,
});

const terms = (overrides: Partial<MediaTerms> = {}): MediaTerms => ({
  generalDiscountType: 'AMOUNT',
  generalDiscountValue: 0,
  commissionType: 'PERCENT',
  commissionValue: 20,
  negotiatedCommission: null,
  feeType: 'PERCENT',
  feeValue: 0,
  ...overrides,
});

describe('linha da grade', () => {
  it('quantidade × unitário menos desconto em % ou em valor', () => {
    expect(lineSubtotal(line())).toBe(1500);
    expect(lineSubtotal(line({ discountValue: 10 }))).toBe(1350);
    expect(lineSubtotal(line({ discountType: 'AMOUNT', discountValue: 100.5 }))).toBe(1399.5);
    expect(lineSubtotal(line({ quantity: 3, unitValue: 33.33 }))).toBe(99.99);
  });

  it('zerado dá zero e desconto maior que a linha é recusado', () => {
    expect(lineSubtotal(line({ quantity: 0, discountType: 'AMOUNT', discountValue: 50 }))).toBe(0);
    expect(() => lineSubtotal(line({ discountType: 'AMOUNT', discountValue: 2000 }))).toThrow(/desconto/);
    expect(() => lineSubtotal(line({ quantity: -1 }))).toThrow();
  });
});

describe('grade e mídia', () => {
  const grid = gridTotals([
    line(),
    line({ quantity: 4, unitValue: 100, discountValue: 50 }),
    line({ quantity: 2, unitValue: 100, isBonus: true }),
  ]);

  it('bonificação fica fora do valor da grade', () => {
    expect(grid).toEqual({ gross: 1900, discount: 200, bonus: 200, total: 1700, insertions: 16 });
  });

  it('total, comissão de 20%, líquido e honorários', () => {
    const totals = mediaTotals([grid, gridTotals([line({ quantity: 1, unitValue: 300 })])], terms({ feeValue: 5 }));
    expect(totals).toEqual({
      gridsTotal: 2000,
      bonusTotal: 200,
      generalDiscount: 0,
      total: 2000,
      commission: 400,
      net: 1600,
      partial: 400,
      fee: 100,
    });
  });

  it('desconto geral entra antes da comissão; comissão negociada só reduz o que a agência cobra', () => {
    const totals = mediaTotals([grid], terms({ generalDiscountValue: 700, negotiatedCommission: 5 }));
    expect(totals.total).toBe(1000);
    expect(totals.commission).toBe(200);
    expect(totals.net).toBe(800);
    expect(totals.partial).toBe(50);
  });

  it('recusa comissão maior que o total e negociada maior que a comissão', () => {
    expect(() => mediaTotals([grid], terms({ commissionType: 'AMOUNT', commissionValue: 5000 }))).toThrow(/comissão/);
    expect(() => mediaTotals([grid], terms({ negotiatedCommission: 30 }))).toThrow(/negociada/);
    expect(() => mediaTotals([grid], terms({ generalDiscountValue: 9999 }))).toThrow(/desconto/);
  });
});

describe('faturas por tipo de faturamento', () => {
  const totals = mediaTotals([gridTotals([line({ quantity: 1, unitValue: 1000 })])], terms());

  it('FLCC: veículo recebe o líquido do cliente e a agência a comissão', () => {
    expect(billingPlan('FLCC', totals, false)).toEqual([
      { invoiceClass: 'THIRD_PARTY_RECEIVES_NET_CLIENT', amount: 800, payer: 'client', payee: 'thirdParty', kind: null },
      { invoiceClass: 'AGENCY_RECEIVES_COMMISSION_CLIENT', amount: 200, payer: 'client', payee: 'agency', kind: 'REVENUE' },
    ]);
  });

  it('FBCC: veículo recebe o bruto e paga a comissão à agência', () => {
    expect(billingPlan('FBCC', totals, false).map((i) => [i.invoiceClass, i.amount])).toEqual([
      ['THIRD_PARTY_RECEIVES_TOTAL_CLIENT', 1000],
      ['AGENCY_RECEIVES_COMMISSION_THIRD_PARTY', 200],
    ]);
  });

  it('FLCA, FL+CCA e FBCA passam pelo caixa da agência', () => {
    expect(billingPlan('FLCA', totals, false).map((i) => [i.invoiceClass, i.amount, i.kind])).toEqual([
      ['AGENCY_RECEIVES_COMMISSION_CLIENT', 200, 'REVENUE'],
      ['AGENCY_PAYS_NET_THIRD_PARTY', 800, 'EXPENSE'],
    ]);
    expect(billingPlan('FL_CCA', totals, false)).toHaveLength(3);
    expect(billingPlan('FBCA', totals, false).map((i) => i.amount)).toEqual([1000, 1000, 200]);
  });

  it('faturas zeradas não nascem; honorários entram como receita', () => {
    const noCommission = mediaTotals([gridTotals([line({ quantity: 1, unitValue: 1000 })])], terms({ commissionValue: 0, feeType: 'AMOUNT', feeValue: 150 }));
    expect(billingPlan('FLCC', noCommission, false).map((i) => [i.invoiceClass, i.amount])).toEqual([
      ['THIRD_PARTY_RECEIVES_NET_CLIENT', 1000],
      ['FEE', 150],
    ]);
  });

  it('comissão negociada não vale nos tipos bruto', () => {
    expect(allowsNegotiatedCommission('FBCA')).toBe(false);
    expect(() => billingPlan('FBCC', totals, true)).toThrow(/negociada/);
  });
});

describe('TV, rádio e externa', () => {
  // 2026-10-19 é segunda-feira.
  it('calendário só nos dias em que o programa vai ao ar e dentro do período', () => {
    const period = { start: '2026-10-19', end: '2026-10-25' };
    expect(dailyInsertionsQuantity({ '2026-10-19': 2, '2026-10-21': 3, '2026-10-22': 0 }, [1, 3, 5], period)).toBe(5);
    expect(() => dailyInsertionsQuantity({ '2026-10-20': 1 }, [1, 3, 5], period)).toThrow(/não vai ao ar/);
    expect(() => dailyInsertionsQuantity({ '2026-10-26': 1 }, [1], period)).toThrow(/fora do período/);
    expect(() => dailyInsertionsQuantity({ '2026-10-19': 1.5 }, [1], period)).toThrow(/inteiras/);
  });

  it('bi-semanas contam sem repetir', () => {
    expect(biweeksQuantity([3, 4, 4, 5])).toBe(3);
    expect(() => biweeksQuantity([0])).toThrow();
  });
});
