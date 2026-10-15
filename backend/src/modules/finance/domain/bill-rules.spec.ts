import { makePermissions } from '../../auth/public/testing.js';
import {
  addMonths,
  cancelTargets,
  canEditBill,
  canTransfer,
  canViewBill,
  canWriteKind,
  finalAmount,
  nextBillSituation,
  planInstallments,
} from './bill-rules.js';

describe('parcelas', () => {
  it('à vista: uma parcela com o valor', () => {
    expect(planInstallments({ amount: 100, condition: 'SINGLE', firstDueDate: '2026-11-10' })).toEqual([
      { number: 1, dueDate: '2026-11-10', amount: 100 },
    ]);
  });

  it('parcelado divide e a sobra vai para a última; datas mensais sem pular mês', () => {
    const plan = planInstallments({ amount: 100, condition: 'INSTALLMENTS', count: 3, firstDueDate: '2026-01-31' });
    expect(plan.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(plan.map((p) => p.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('recorrente repete o valor cheio na frequência', () => {
    const plan = planInstallments({ amount: 50, condition: 'RECURRING', count: 3, firstDueDate: '2026-10-01', frequency: 'WEEKLY' });
    expect(plan.map((p) => [p.dueDate, p.amount])).toEqual([
      ['2026-10-01', 50],
      ['2026-10-08', 50],
      ['2026-10-15', 50],
    ]);
  });

  it('recusa menos de 2 parcelas, valor zero e parcelas de centavo zero', () => {
    expect(() => planInstallments({ amount: 10, condition: 'INSTALLMENTS', count: 1, firstDueDate: '2026-10-01' })).toThrow(/2 parcelas/);
    expect(() => planInstallments({ amount: 0, condition: 'SINGLE', firstDueDate: '2026-10-01' })).toThrow(/maior que zero/);
    expect(() => planInstallments({ amount: 0.05, condition: 'INSTALLMENTS', count: 10, firstDueDate: '2026-10-01' })).toThrow(/pequeno/);
  });

  it('soma meses no fim de ano e em ano bissexto', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
});

describe('valor final e situação', () => {
  it('valor + acréscimos − descontos', () => {
    expect(finalAmount(100, 10.5, 20)).toBe(90.5);
    expect(() => finalAmount(100, 0, 100.01)).toThrow(/desconto/);
  });

  it('quitar, cancelar e reabrir', () => {
    expect(nextBillSituation('OPEN', 'settle')).toBe('PAID');
    expect(nextBillSituation('PAID', 'cancel')).toBeNull();
    expect(nextBillSituation('CANCELED', 'reopen')).toBe('OPEN');
  });

  it('cancelar parcelado: só esta, esta e as próximas abertas, ou todas abertas', () => {
    const group = [
      { id: 'p1', installmentNumber: 1, situation: 'PAID' as const },
      { id: 'p2', installmentNumber: 2, situation: 'OPEN' as const },
      { id: 'p3', installmentNumber: 3, situation: 'OPEN' as const },
      { id: 'p4', installmentNumber: 4, situation: 'CANCELED' as const },
    ];
    expect(cancelTargets(group[2], group, 'this')).toEqual(['p3']);
    expect(cancelTargets(group[1], group, 'next')).toEqual(['p2', 'p3']);
    expect(cancelTargets(group[2], group, 'all')).toEqual(['p2', 'p3']);
  });
});

describe('permissões do financeiro', () => {
  const financeiro = makePermissions({ financial: 6 }, { financialRevenues: true, financialExpenses: true, financialTransfers: true });
  const atendimento = makePermissions({ financial: 1 }, { financialRevenues: true });

  it('nível 1 vê e altera só o que criou', () => {
    expect(canViewBill('ana', atendimento, { kind: 'REVENUE', createdById: 'ana' })).toBe(true);
    expect(canViewBill('ana', atendimento, { kind: 'REVENUE', createdById: 'joao' })).toBe(false);
    expect(canEditBill('ana', financeiro, { kind: 'EXPENSE', createdById: 'joao' })).toBe(true);
  });

  it('receitas, despesas e transferências têm permissão própria', () => {
    expect(canWriteKind(atendimento, 'REVENUE')).toBe(true);
    expect(canWriteKind(atendimento, 'EXPENSE')).toBe(false);
    expect(canTransfer(atendimento)).toBe(false);
    expect(canTransfer(financeiro)).toBe(true);
  });
});
