// Leitura dos dados exportados do Operand (pasta dados-operand/, fora do Git), usada pelas cargas.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const DIR = new URL('../../dados-operand/', import.meta.url);

export const readOperand = (name: string) => JSON.parse(readFileSync(new URL(name, DIR), 'utf8'));

/** Uma mídia por linha (midias.jsonl). */
export const readOperandLines = (name: string): any[] =>
  readFileSync(new URL(name, DIR), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));

/** "2026-10-21 23:59:59" no fuso da agência; "0000-00-00 ..." = vazio. */
// shortcut: fixo em -03:00, datas antigas do horário de verão (até 2019) ficam 1 h deslocadas; irrelevante para prazos.
export function operandDate(value: string | null | undefined): Date | null {
  if (!value || value.startsWith('0000')) return null;
  return new Date(value.replace(' ', 'T') + '-03:00');
}

/** "2026-10-21" (ou com hora) → coluna DATE. */
export function operandDay(value: string | null | undefined): Date | null {
  if (!value || value.startsWith('0000')) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

/** Textos do Operand são HTML; o operador guarda texto puro (e nunca renderiza HTML). */
export function htmlToText(html: unknown): string | null {
  // O legado manda {} no lugar de texto vazio.
  if (typeof html === 'number') html = String(html);
  if (!html || typeof html !== 'string') return null;
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => NAMED[name] ?? NAMED[name[0].toLowerCase() + name.slice(1)]?.toUpperCase() ?? entity)
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}
// Acentos que o legado (app3) manda como entidade, ex.: "Namorados e S&atilde;o João".
const NAMED: Record<string, string> = Object.fromEntries(
  [...'áàâãäéèêëíìîïóòôõöúùûüçñ'].map((c) => {
    const base = c.normalize('NFD')[0];
    const mark = { '́': 'acute', '̀': 'grave', '̂': 'circ', '̃': 'tilde', '̈': 'uml', '̧': 'cedil' }[c.normalize('NFD')[1]];
    return [`${base}${mark}`, c];
  }),
);

/** Nomes do legado podem vir com entidades HTML. */
export const plain = (value: unknown) => htmlToText(value) ?? '';

assert.equal(
  htmlToText('<p>Oi&nbsp;<b>A&amp;B</b></p><ul><li>um</li></ul><img src="data:image/png;base64,AAA">x &#233;'),
  'Oi A&B\n\n- um\nx é',
);
assert.equal(htmlToText('S&atilde;o Jo&atilde;o &ccedil; &Eacute;'), 'São João ç É');
assert.equal(operandDate('0000-00-00 00:00:00'), null);
assert.equal(operandDate('2026-10-21 23:59:59')!.toISOString(), '2026-10-22T02:59:59.000Z');
assert.equal(operandDay('2026-10-21 10:00:00')!.toISOString(), '2026-10-21T00:00:00.000Z');
