import { endOfLocalDay, localDate, zonedToUtc } from './timezone.js';

describe('fuso da agência', () => {
  it('fim do dia em São Paulo (UTC-3) é 02:59:59.999 do dia seguinte em UTC', () => {
    expect(endOfLocalDay('2026-10-20', 'America/Sao_Paulo').toISOString()).toBe(
      '2026-10-21T02:59:59.999Z',
    );
  });

  it('converte hora local em UTC e volta para a data local', () => {
    const instant = zonedToUtc({ year: 2026, month: 1, day: 1, hour: 22 }, 'America/Sao_Paulo');
    expect(instant.toISOString()).toBe('2026-01-02T01:00:00.000Z');
    expect(localDate(instant, 'America/Sao_Paulo')).toBe('2026-01-01');
    expect(localDate(instant, 'UTC')).toBe('2026-01-02');
  });

  it('respeita o horário de verão de outros fusos', () => {
    // Nova York: UTC-4 em julho, UTC-5 em janeiro.
    expect(zonedToUtc({ year: 2026, month: 7, day: 1, hour: 12 }, 'America/New_York').toISOString()).toBe(
      '2026-07-01T16:00:00.000Z',
    );
    expect(zonedToUtc({ year: 2026, month: 1, day: 1, hour: 12 }, 'America/New_York').toISOString()).toBe(
      '2026-01-01T17:00:00.000Z',
    );
  });

  it('recusa data fora do formato', () => {
    expect(() => endOfLocalDay('20/10/2026', 'UTC')).toThrow();
  });
});
