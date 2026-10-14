import { makePermissions } from '../../auth/public/testing.js';
import {
  becomesManual,
  canManageEntry,
  canSeeOthers,
  elapsedMinutes,
  manualEntryError,
  nextDay,
  periodsError,
  weeklyMinutes,
} from './time-rules.js';

describe('regras do timesheet', () => {
  it('tempo do cronômetro em minutos arredondados', () => {
    const start = new Date('2026-10-14T12:00:00Z');
    expect(elapsedMinutes(start, new Date('2026-10-14T12:44:31Z'))).toBe(45);
    expect(elapsedMinutes(start, new Date('2026-10-14T12:00:20Z'))).toBe(0);
    expect(elapsedMinutes(start, new Date('2026-10-14T11:00:00Z'))).toBe(0);
  });

  it('apontamento manual: sem data futura e com tempo entre 1 min e 24 h', () => {
    expect(manualEntryError('2026-10-14', 90, '2026-10-14')).toBeNull();
    expect(manualEntryError('2026-10-15', 90, '2026-10-14')).toMatch(/futura/);
    expect(manualEntryError('2026-10-10', 0, '2026-10-14')).toMatch(/tempo/);
    expect(manualEntryError('2026-10-10', 1441, '2026-10-14')).toMatch(/24 horas/);
    expect(manualEntryError('14/10/2026', 30, '2026-10-14')).toMatch(/Data/);
  });

  it('cada um mexe nos seus; nível Total mexe nos de todos', () => {
    const creative = makePermissions({ jobs: 3 });
    const full = makePermissions({ jobs: 6 });
    expect(canManageEntry('ana', 'ana', creative)).toBe(true);
    expect(canManageEntry('ana', 'joao', creative)).toBe(false);
    expect(canManageEntry('ana', 'joao', full)).toBe(true);
    expect(canSeeOthers(makePermissions({ jobs: 1 }))).toBe(false);
    expect(canSeeOthers(creative)).toBe(true);
  });

  it('editar tempo ou data vira apontamento manual', () => {
    expect(becomesManual({ minutes: 30 })).toBe(true);
    expect(becomesManual({ date: '2026-10-01' })).toBe(true);
    expect(becomesManual({})).toBe(false);
  });

  it('jornada: valida faixas e soma 42h30 na jornada padrão', () => {
    const day = [
      { start: '08:30', end: '12:00' },
      { start: '13:00', end: '18:00' },
    ];
    const week = { 1: day, 2: day, 3: day, 4: day, 5: day };
    expect(periodsError(week)).toBeNull();
    expect(weeklyMinutes(week)).toBe(42 * 60 + 30);
    expect(periodsError({ 1: [{ start: '12:00', end: '08:00' }] })).toMatch(/depois/);
    expect(periodsError({ 1: [{ start: '08:00', end: '12:00' }, { start: '11:00', end: '13:00' }] })).toMatch(/sobrepostas/);
    expect(periodsError({ 7: day })).toMatch(/Dia/);
    expect(periodsError({ 1: [{ start: '8h', end: '12:00' }] })).toMatch(/HH:MM/);
  });

  it('troca de jornada vale a partir do dia seguinte', () => {
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});
