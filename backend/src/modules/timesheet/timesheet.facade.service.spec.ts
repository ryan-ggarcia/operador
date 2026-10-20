import { ForbiddenException } from '@nestjs/common';
import { makePermissions } from '../auth/public/testing.js';
import type { TimeEntriesService } from './entries/time-entries.service.js';
import { TimesheetFacadeService } from './timesheet.facade.service.js';

describe('TimesheetFacadeService: horas do job para o assistente', () => {
  const documentSummary = vi.fn(async () => ({
    estimatedMinutes: 120,
    realizedMinutes: 90,
    balanceMinutes: 30,
    runningUserIds: [],
    entries: [],
  }));
  const facade = new TimesheetFacadeService({} as never, { documentSummary } as unknown as TimeEntriesService);

  it('sem acesso a jobs, mídias ou produções não consulta', async () => {
    await expect(facade.getJobHoursForUser('u1', makePermissions({ financial: 7 }), 'j1')).rejects.toThrow(ForbiddenException);
    expect(documentSummary).not.toHaveBeenCalled();
  });

  it('sem leitura total em jobs a lista é só dos próprios apontamentos', async () => {
    const hours = await facade.getJobHoursForUser('u1', makePermissions({ jobs: 1 }), 'j1');
    expect(hours).toMatchObject({ realizedMinutes: 90, onlyOwnEntries: true });
  });
});
