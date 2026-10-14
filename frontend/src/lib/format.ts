/** Formatação para a tela, no fuso e no idioma da agência. */

const TIMEZONE = 'America/Sao_Paulo';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const shortDateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE, day: '2-digit', month: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });
const isoDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormat.format(new Date(value)) : '—';
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

/** Prazo: só a data quando não tem hora (vale até o fim do dia). */
export function formatDeadline(value: string | null, hasTime: boolean): string {
  if (!value) return 'Sem prazo';
  const date = new Date(value);
  return hasTime ? `${shortDateFormat.format(date)} ${timeFormat.format(date)}` : shortDateFormat.format(date);
}

/**
 * Data e hora digitadas (fuso da agência) → ISO. São Paulo está em UTC-3 o
 * ano todo desde o fim do horário de verão (2019).
 */
export function localDateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

/** Hora local "HH:MM" de um instante. */
export function toLocalTimeInput(value: string | null | undefined): string {
  return value ? timeFormat.format(new Date(value)) : '';
}

/** Data local "AAAA-MM-DD" (para inputs type=date). */
export function toLocalDateInput(value: string | null | undefined): string {
  return value ? isoDateFormat.format(new Date(value)) : '';
}

export function isDueToday(value: string | null): boolean {
  return Boolean(value) && toLocalDateInput(value) === isoDateFormat.format(new Date());
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

/** "1:30", "1h30", "90" ou "1,5" → minutos. */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  const clock = /^(\d{1,2})[:h](\d{1,2})?m?$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2] ?? 0);
  const hours = /^(\d+)[,.](\d+)$/.exec(value);
  if (hours) return Math.round(Number(`${hours[1]}.${hours[2]}`) * 60);
  if (/^\d+$/.test(value)) return Number(value);
  return null;
}

export function formatMoney(value: number | null | undefined): string {
  return value == null ? '—' : money.format(value);
}

/** CPF ou CNPJ com máscara. */
export function formatDocument(value: string | null): string {
  if (!value) return '—';
  if (value.length === 11) return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (value.length === 14) return value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return value;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Texto simples digitado → HTML de parágrafos (o servidor higieniza). */
export function textToHtml(text: string): string {
  const escape = (line: string) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.split('\n').map(escape).join('<br>')}</p>`)
    .join('');
}

/** HTML do servidor → texto para editar num textarea. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}
