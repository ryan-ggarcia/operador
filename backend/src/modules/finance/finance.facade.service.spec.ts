import { ForbiddenException } from '@nestjs/common';
import { makePermissions } from '../auth/public/testing.js';
import type { TreasuryService } from './bills/treasury.service.js';
import { FinanceFacadeService } from './finance.facade.service.js';

describe('FinanceFacadeService: resumo para o assistente', () => {
  const treasury = {
    summary: vi.fn(async () => ({ revenuePaid: 10, revenueOpen: 0, expensePaid: 4, expenseOpen: 0 })),
    listAccounts: async () => [
      { name: 'Principal', balance: 6, active: true },
      { name: 'Antiga', balance: 1, active: false },
    ],
  } as unknown as TreasuryService;
  const facade = new FinanceFacadeService({} as never, {} as never, treasury);

  it('sem acesso ao financeiro não consulta nada', async () => {
    await expect(facade.getPeriodSummaryForUser('u1', makePermissions({ jobs: 7 }), '2026-10-01', '2026-11-01'))
      .rejects.toThrow(ForbiddenException);
    expect(treasury.summary).not.toHaveBeenCalled();
  });

  it('nível 1 vê só os próprios lançamentos; contas inativas ficam de fora', async () => {
    const summary = await facade.getPeriodSummaryForUser('u1', makePermissions({ financial: 1 }), '2026-10-01', '2026-11-01');
    expect(summary).toMatchObject({ onlyOwnBills: true, accounts: [{ name: 'Principal', balance: 6 }] });
  });
});
