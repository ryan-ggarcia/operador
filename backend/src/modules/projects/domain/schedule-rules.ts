/**
 * Recorrência, adiamento de prazos e workflow de tarefas
 * (docs/operand/jobs.md, 2.5 e 2.6). Datas locais em "AAAA-MM-DD"; o fuso
 * fica com quem chama.
 */

export class ScheduleRuleError extends Error {}

/** Limite de jobs por recorrência, contando o job original. */
export const MAX_RECURRENCE = 50;

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurrenceRule {
  frequency: Frequency;
  /** A cada N dias, semanas ou meses. */
  interval: number;
  /** Diária: conta só dias úteis (seg. a sex.). */
  businessDaysOnly?: boolean;
  /** Semanal: dias da semana (0 = domingo … 6 = sábado). */
  weekdays?: number[];
  /** Mensal: mesmo dia do mês (limitado ao último dia) ou sempre o último dia. */
  monthlyMode?: 'SAME_DAY' | 'LAST_DAY';
  /** Termina após N vezes (contando o job original)… */
  count?: number;
  /** …ou numa data (inclusive). */
  until?: string;
}

const DAY = 86_400_000;

function toUtc(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new ScheduleRuleError(`Data inválida: ${date}.`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function fromUtc(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY);
}

export function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function isWeekend(date: string): boolean {
  const day = weekday(date);
  return day === 0 || day === 6;
}

/** Dias corridos de `from` até `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY);
}

export function addBusinessDays(date: string, days: number): string {
  let current = date;
  for (let added = 0; added < days; ) {
    current = addDays(current, 1);
    if (!isWeekend(current)) added++;
  }
  return current;
}

/** Fim de semana vai para a segunda-feira seguinte. */
export function nextBusinessDay(date: string): string {
  let current = date;
  while (isWeekend(current)) current = addDays(current, 1);
  return current;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28 ou 29/02) ou indo ao último dia. */
export function addMonths(date: string, months: number, lastDay = false): string {
  const base = new Date(toUtc(date));
  const total = base.getUTCMonth() + months;
  const year = base.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = lastDayOfMonth(year, month);
  const day = lastDay ? last : Math.min(base.getUTCDate(), last);
  return fromUtc(Date.UTC(year, month, day));
}

export function validateRule(rule: RecurrenceRule): void {
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 365) {
    throw new ScheduleRuleError('O intervalo da recorrência precisa ser de 1 a 365.');
  }
  if (rule.count === undefined && !rule.until) throw new ScheduleRuleError('Diga quando a recorrência termina.');
  if (rule.count !== undefined && (!Number.isInteger(rule.count) || rule.count < 2)) {
    throw new ScheduleRuleError('A recorrência precisa de pelo menos 2 vezes.');
  }
  if (rule.count !== undefined && rule.count > MAX_RECURRENCE) {
    throw new ScheduleRuleError(`A recorrência pode ter no máximo ${MAX_RECURRENCE} jobs.`);
  }
  if (rule.frequency === 'WEEKLY') {
    const days = rule.weekdays ?? [];
    if (days.length === 0) throw new ScheduleRuleError('Escolha pelo menos um dia da semana.');
    if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new ScheduleRuleError('Dia da semana inválido.');
    }
  }
}

/**
 * Datas das próximas ocorrências depois do prazo do job original (que é a
 * 1ª). Para em `count` (contando a original) ou em `until`; passar de 50
 * jobs é erro, para o usuário encurtar a regra.
 */
export function recurrenceDates(base: string, rule: RecurrenceRule): string[] {
  validateRule(rule);
  if (rule.until && rule.until <= base) throw new ScheduleRuleError('A data final precisa ser depois do prazo do job.');
  const wanted = (rule.count ?? MAX_RECURRENCE + 1) - 1;
  const dates: string[] = [];
  const accept = (date: string): boolean => {
    if (rule.until && date > rule.until) return false;
    dates.push(date);
    return dates.length < wanted;
  };

  if (rule.frequency === 'DAILY') {
    let current = base;
    do {
      current = rule.businessDaysOnly ? addBusinessDays(current, rule.interval) : addDays(current, rule.interval);
    } while (accept(current));
  } else if (rule.frequency === 'WEEKLY') {
    const days = [...new Set(rule.weekdays)].sort((a, b) => a - b);
    const weekStart = addDays(base, -weekday(base));
    outer: for (let week = 0; ; week += rule.interval) {
      for (const day of days) {
        const date = addDays(weekStart, week * 7 + day);
        if (date <= base) continue;
        if (!accept(date)) break outer;
      }
    }
  } else {
    const lastDay = rule.monthlyMode === 'LAST_DAY';
    for (let step = 1; accept(addMonths(base, step * rule.interval, lastDay)); step++);
  }

  // Só com data final dá para passar do limite (`wanted` é 50 sem `count`).
  if (dates.length + 1 > MAX_RECURRENCE) {
    throw new ScheduleRuleError(`A recorrência passa de ${MAX_RECURRENCE} jobs: escolha uma data final mais próxima.`);
  }
  return dates;
}

export type ShiftUnit = 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

export interface LocalMoment {
  date: string;
  /** Minutos desde a meia-noite. */
  minutes: number;
}

/** Adia um momento local; com "somente dias úteis", fim de semana não vale. */
export function shiftMoment(moment: LocalMoment, amount: number, unit: ShiftUnit, businessDaysOnly: boolean): LocalMoment {
  if (!Number.isInteger(amount) || amount < 1) throw new ScheduleRuleError('Informe quanto adiar (1 ou mais).');
  if (unit === 'MINUTES' || unit === 'HOURS') {
    const total = moment.minutes + amount * (unit === 'HOURS' ? 60 : 1);
    const date = addDays(moment.date, Math.floor(total / 1440));
    return { date: businessDaysOnly ? nextBusinessDay(date) : date, minutes: total % 1440 };
  }
  if (unit === 'DAYS' && businessDaysOnly) {
    return { date: addBusinessDays(moment.date, amount), minutes: moment.minutes };
  }
  const date =
    unit === 'DAYS'
      ? addDays(moment.date, amount)
      : unit === 'WEEKS'
        ? addDays(moment.date, amount * 7)
        : addMonths(moment.date, amount * (unit === 'YEARS' ? 12 : 1));
  return { date: businessDaysOnly ? nextBusinessDay(date) : date, minutes: moment.minutes };
}

export interface WorkflowTask {
  id: string;
  title: string;
  situation: 'OPEN' | 'DONE' | 'CANCELED';
  dependsOnIds: string[];
}

/** Tarefas abertas de que esta depende (a tarefa fica bloqueada até concluírem). */
export function blockers(task: WorkflowTask, tasks: WorkflowTask[]): WorkflowTask[] {
  return tasks.filter((other) => task.dependsOnIds.includes(other.id) && other.situation === 'OPEN');
}

/** Dependências válidas: tarefas do mesmo job, sem a própria e sem ciclo. */
export function checkDependencies(taskId: string, dependsOnIds: string[], tasks: WorkflowTask[]): string[] {
  const unique = [...new Set(dependsOnIds)];
  if (unique.includes(taskId)) throw new ScheduleRuleError('A tarefa não pode depender dela mesma.');
  const byId = new Map(tasks.map((task) => [task.id, task]));
  if (unique.some((id) => !byId.has(id))) throw new ScheduleRuleError('Só tarefas do mesmo job podem ser dependências.');
  // Ciclo: alguma dependência (direta ou indireta) já depende desta tarefa.
  const seen = new Set<string>();
  const stack = [...unique];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === taskId) throw new ScheduleRuleError('Essas dependências formariam um ciclo.');
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.dependsOnIds ?? []));
  }
  return unique;
}

/** Workflow: cada tarefa aberta depende da anterior, na ordem. */
export function workflowChain(openTaskIds: string[]): { taskId: string; dependsOnId: string }[] {
  if (openTaskIds.length < 2) throw new ScheduleRuleError('O workflow precisa de pelo menos 2 tarefas abertas.');
  return openTaskIds.slice(1).map((taskId, index) => ({ taskId, dependsOnId: openTaskIds[index]! }));
}
