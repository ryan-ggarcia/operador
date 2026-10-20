import {
  addMonths,
  blockers,
  checkDependencies,
  recurrenceDates,
  shiftMoment,
  workflowChain,
} from './schedule-rules.js';

describe('recorrência', () => {
  it('diária, com e sem dias úteis', () => {
    expect(recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 2, count: 4 })).toEqual([
      '2026-10-17',
      '2026-10-19',
      '2026-10-21',
    ]);
    // 15/10/2026 é quinta: sexta, segunda, terça.
    expect(recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 1, businessDaysOnly: true, count: 4 })).toEqual([
      '2026-10-16',
      '2026-10-19',
      '2026-10-20',
    ]);
  });

  it('semanal nos dias escolhidos, a cada N semanas', () => {
    // seg (1) e qua (3), a cada 2 semanas, a partir de qui 15/10.
    expect(recurrenceDates('2026-10-15', { frequency: 'WEEKLY', interval: 2, weekdays: [3, 1], count: 4 })).toEqual([
      '2026-10-26',
      '2026-10-28',
      '2026-11-09',
    ]);
    expect(() => recurrenceDates('2026-10-15', { frequency: 'WEEKLY', interval: 1, weekdays: [], count: 3 })).toThrow(
      'dia da semana',
    );
  });

  it('mensal no mesmo dia (limitado ao fim do mês) ou no último dia', () => {
    expect(recurrenceDates('2026-01-31', { frequency: 'MONTHLY', interval: 1, count: 3 })).toEqual(['2026-02-28', '2026-03-31']);
    expect(recurrenceDates('2026-04-10', { frequency: 'MONTHLY', interval: 1, monthlyMode: 'LAST_DAY', count: 3 })).toEqual([
      '2026-05-31',
      '2026-06-30',
    ]);
    expect(addMonths('2027-11-30', 3)).toBe('2028-02-29');
  });

  it('termina na data final e respeita o limite de 50', () => {
    expect(recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 7, until: '2026-11-05' })).toEqual([
      '2026-10-22',
      '2026-10-29',
      '2026-11-05',
    ]);
    expect(() => recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 1, until: '2027-10-15' })).toThrow('passa de 50');
    expect(recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 1, count: 50 })).toHaveLength(49);
    expect(() => recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 1, count: 51 })).toThrow('no máximo 50');
    expect(() => recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 1 })).toThrow('termina');
    expect(() => recurrenceDates('2026-10-15', { frequency: 'DAILY', interval: 1, until: '2026-10-15' })).toThrow('depois');
  });
});

describe('adiar', () => {
  const friday = { date: '2026-10-16', minutes: 17 * 60 };
  it('em dias, com e sem dias úteis', () => {
    expect(shiftMoment(friday, 1, 'DAYS', false)).toEqual({ date: '2026-10-17', minutes: 1020 });
    expect(shiftMoment(friday, 1, 'DAYS', true)).toEqual({ date: '2026-10-19', minutes: 1020 });
    expect(shiftMoment(friday, 1, 'WEEKS', false).date).toBe('2026-10-23');
  });
  it('em horas vira o dia; em meses mantém o dia', () => {
    expect(shiftMoment(friday, 8, 'HOURS', false)).toEqual({ date: '2026-10-17', minutes: 60 });
    expect(shiftMoment(friday, 8, 'HOURS', true)).toEqual({ date: '2026-10-19', minutes: 60 });
    expect(shiftMoment({ date: '2026-01-31', minutes: 0 }, 1, 'MONTHS', false).date).toBe('2026-02-28');
    expect(shiftMoment(friday, 1, 'YEARS', false).date).toBe('2027-10-16');
    expect(() => shiftMoment(friday, 0, 'DAYS', false)).toThrow('1 ou mais');
  });
});

describe('workflow', () => {
  const tasks = [
    { id: 'a', title: 'A', situation: 'OPEN' as const, dependsOnIds: [] },
    { id: 'b', title: 'B', situation: 'OPEN' as const, dependsOnIds: ['a'] },
    { id: 'c', title: 'C', situation: 'OPEN' as const, dependsOnIds: ['b'] },
  ];
  it('encadeia as abertas e aponta quem bloqueia', () => {
    expect(workflowChain(['a', 'b', 'c'])).toEqual([
      { taskId: 'b', dependsOnId: 'a' },
      { taskId: 'c', dependsOnId: 'b' },
    ]);
    expect(() => workflowChain(['a'])).toThrow('2 tarefas');
    expect(blockers(tasks[1]!, tasks).map((task) => task.id)).toEqual(['a']);
    expect(blockers(tasks[1]!, [{ ...tasks[0]!, situation: 'DONE' }, tasks[1]!])).toEqual([]);
  });
  it('recusa ciclo, a própria tarefa e tarefa de outro job', () => {
    expect(checkDependencies('c', ['a', 'a'], tasks)).toEqual(['a']);
    expect(() => checkDependencies('a', ['c'], tasks)).toThrow('ciclo');
    expect(() => checkDependencies('a', ['a'], tasks)).toThrow('dela mesma');
    expect(() => checkDependencies('a', ['x'], tasks)).toThrow('mesmo job');
  });
});
