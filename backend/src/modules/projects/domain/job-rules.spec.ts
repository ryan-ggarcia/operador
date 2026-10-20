import { makePermissions } from '../../auth/public/testing.js';
import {
  canActOnJob,
  canEditJob,
  canViewJob,
  documentNumber,
  isOverdue,
  isValidSchedule,
  nextJobSituation,
  type JobAccessView,
} from './job-rules.js';

const job = (overrides: Partial<JobAccessView> = {}): JobAccessView => ({
  situation: 'OPEN',
  responsibleId: 'resp',
  requesterId: 'req',
  memberIds: ['membro'],
  projectHidden: false,
  involvedInProject: false,
  ...overrides,
});

describe('regras de job', () => {
  // Perfil "Criativo" do Operand: jobs nível 3.
  const creative = makePermissions({ jobs: 3 });
  const own = makePermissions({ jobs: 1 });
  const readAll = makePermissions({ jobs: 2 });
  const full = makePermissions({ jobs: 6 });
  const admin = makePermissions({ jobs: 7 });

  it('nível 1 vê só os jobs em que está envolvido', () => {
    expect(canViewJob('membro', own, job())).toBe(true);
    expect(canViewJob('outro', own, job())).toBe(false);
    expect(canViewJob('outro', creative, job())).toBe(true);
  });

  it('job de projeto oculto: envolvidos no job ou no projeto, e o administrador', () => {
    const hidden = job({ projectHidden: true });
    expect(canViewJob('outro', full, hidden)).toBe(false);
    expect(canViewJob('outro', full, job({ projectHidden: true, involvedInProject: true }))).toBe(true);
    expect(canViewJob('membro', readAll, hidden)).toBe(true);
    expect(canViewJob('outro', admin, hidden)).toBe(true);
  });

  it('nível 3 lê todos e altera só os seus; leitura total não altera', () => {
    expect(canEditJob('membro', creative, job())).toBe(true);
    expect(canEditJob('outro', creative, job())).toBe(false);
    expect(canEditJob('membro', readAll, job())).toBe(false);
    expect(canEditJob('outro', full, job())).toBe(true);
  });

  it('job fechado não se edita, mas quem pode agir consegue reabrir', () => {
    const done = job({ situation: 'DONE' });
    expect(canEditJob('resp', full, done)).toBe(false);
    expect(canActOnJob('resp', full, done)).toBe(true);
  });

  it('transições do job', () => {
    expect(nextJobSituation('OPEN', 'complete')).toBe('DONE');
    expect(nextJobSituation('OPEN', 'cancel')).toBe('CANCELED');
    expect(nextJobSituation('DONE', 'cancel')).toBeNull();
    expect(nextJobSituation('CANCELED', 'reopen')).toBe('OPEN');
    expect(nextJobSituation('OPEN', 'reopen')).toBeNull();
  });

  it('atraso: aberto e com prazo vencido, salvo status que não conta atraso', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const late = { situation: 'OPEN' as const, deadline: new Date('2026-10-14T11:59:59Z') };
    expect(isOverdue(late, false, now)).toBe(true);
    expect(isOverdue(late, true, now)).toBe(false);
    expect(isOverdue({ ...late, situation: 'DONE' }, false, now)).toBe(false);
    expect(isOverdue({ ...late, deadline: null }, false, now)).toBe(false);
    expect(isOverdue({ ...late, deadline: new Date('2026-10-14T12:00:01Z') }, false, now)).toBe(false);
  });

  it('número exibido e prazo depois do início', () => {
    expect(documentNumber(1299, 4)).toBe('1299.4');
    expect(isValidSchedule(new Date('2026-10-02'), new Date('2026-10-01'))).toBe(false);
    expect(isValidSchedule(null, new Date('2026-10-01'))).toBe(true);
  });
});
