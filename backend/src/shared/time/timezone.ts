/** Datas no fuso da agência (ex.: prazo sem hora vale até 23:59:59 local). */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, format);
  }
  return format;
}

/** Diferença, em ms, entre o horário local do fuso e o UTC no instante. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Instante UTC de uma data e hora locais do fuso. */
export function zonedToUtc(
  local: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number; ms?: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour ?? 0,
    local.minute ?? 0,
    local.second ?? 0,
    local.ms ?? 0,
  );
  let result = guess - offsetAt(guess, timeZone);
  // Ajuste para quando o deslocamento muda perto do horário (horário de verão).
  const second = guess - offsetAt(result, timeZone);
  if (second !== result) result = second;
  return new Date(result);
}

/** "AAAA-MM-DD" → fim do dia (23:59:59.999) no fuso. */
export function endOfLocalDay(date: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) throw new Error(`Data inválida: ${date}`);
  return zonedToUtc(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: 23,
      minute: 59,
      second: 59,
      ms: 999,
    },
    timeZone,
  );
}

/** Data local ("AAAA-MM-DD") de um instante no fuso. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
