import { FULL, READ_ALL, type UserPermissions } from '../../auth/public/index.js';

/** Regras de apontamento de horas (docs/operand/timesheet.md, 4). */

/** Um dia inteiro: limite de um apontamento manual. */
export const MAX_ENTRY_MINUTES = 24 * 60;

/** Minutos entre o início e o fim do cronômetro (arredondado). */
export function elapsedMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

/**
 * Apontamento manual: data no formato AAAA-MM-DD, não futura (comparando
 * com a data local de hoje), e tempo entre 1 minuto e 24 horas.
 */
export function manualEntryError(date: string, minutes: number, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Data inválida.';
  if (date > today) return 'O apontamento não pode ter data futura.';
  if (!Number.isInteger(minutes) || minutes < 1) return 'Informe o tempo (pelo menos 1 minuto).';
  if (minutes > MAX_ENTRY_MINUTES) return 'O tempo não pode passar de 24 horas.';
  return null;
}

/** Ver apontamentos de outras pessoas: leitura total em jobs. */
export function canSeeOthers(access: UserPermissions): boolean {
  return access.modules.jobs >= READ_ALL;
}

/** Parar o cronômetro de outra pessoa (gestor): leitura total em jobs. */
export function canStopOthers(access: UserPermissions): boolean {
  return access.modules.jobs >= READ_ALL;
}

/** Editar, excluir ou lançar para outra pessoa: nível Total em jobs. */
export function canManageOthers(access: UserPermissions): boolean {
  return access.modules.jobs >= FULL;
}

export function canManageEntry(userId: string, entryUserId: string, access: UserPermissions): boolean {
  return entryUserId === userId || canManageOthers(access);
}

/** Editar o tempo ou a data de um apontamento o torna manual. */
export function becomesManual(changes: { minutes?: number; date?: string }): boolean {
  return changes.minutes !== undefined || changes.date !== undefined;
}

/** Faixa de horário da jornada ("08:30" a "12:00"). */
export interface Period {
  start: string;
  end: string;
}

/** Dia da semana (0 = domingo) → faixas. */
export type WeekPeriods = Record<string, Period[]>;

function toMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Faixas válidas: horário HH:MM, fim depois do início e sem sobreposição. */
export function periodsError(periods: WeekPeriods): string | null {
  for (const [day, ranges] of Object.entries(periods)) {
    if (!/^[0-6]$/.test(day)) return 'Dia da semana inválido.';
    const sorted = ranges
      .map((range) => ({ start: toMinutes(range.start), end: toMinutes(range.end) }))
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
    for (const [index, range] of sorted.entries()) {
      if (range.start === null || range.end === null) return 'Horário inválido (use HH:MM).';
      if (range.end <= range.start) return 'A saída precisa ser depois da entrada.';
      const previous = sorted[index - 1];
      if (previous && previous.end !== null && range.start < previous.end) {
        return 'Há faixas de horário sobrepostas.';
      }
    }
  }
  return null;
}

/** Minutos de jornada por semana. */
export function weeklyMinutes(periods: WeekPeriods): number {
  return Object.values(periods)
    .flat()
    .reduce((total, range) => total + ((toMinutes(range.end) ?? 0) - (toMinutes(range.start) ?? 0)), 0);
}

/** Dia seguinte de uma data AAAA-MM-DD (troca de jornada vale a partir dele). */
export function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
