import { localDate, localParts, zonedToUtc } from '../../../shared/time/timezone.js';
import { addDays, type LocalMoment } from '../domain/schedule-rules.js';

/** Soma dias de calendário mantendo a hora local (ex.: 10h vira 10h do outro dia). */
export function shiftInstantDays(instant: Date, days: number, timeZone: string): Date {
  if (days === 0) return instant;
  const parts = localParts(instant, timeZone);
  const date = addDays(localDate(instant, timeZone), days);
  const [year, month, day] = date.split('-').map(Number);
  return zonedToUtc({ ...parts, year: year!, month: month!, day: day! }, timeZone);
}

/** Instante → data e minutos locais. */
export function toMoment(instant: Date, timeZone: string): LocalMoment {
  const parts = localParts(instant, timeZone);
  return { date: localDate(instant, timeZone), minutes: parts.hour * 60 + parts.minute };
}

/** Data e minutos locais → instante (mantém segundos e milissegundos do original). */
export function fromMoment(moment: LocalMoment, original: Date, timeZone: string): Date {
  const parts = localParts(original, timeZone);
  const [year, month, day] = moment.date.split('-').map(Number);
  return zonedToUtc(
    {
      year: year!,
      month: month!,
      day: day!,
      hour: Math.floor(moment.minutes / 60),
      minute: moment.minutes % 60,
      second: parts.second,
      ms: parts.ms,
    },
    timeZone,
  );
}
