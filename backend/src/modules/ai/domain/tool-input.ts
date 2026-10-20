/**
 * Entrada das ferramentas do assistente: um só lugar define o JSON Schema
 * enviado ao Claude e a validação feita antes de executar. Com
 * eager_input_streaming a API não valida a entrada, então validamos aqui.
 */

export type Field =
  | { type: 'text'; description: string; max: number }
  | { type: 'uuid'; description: string }
  | { type: 'date'; description: string }
  | { type: 'boolean'; description: string }
  | { type: 'enum'; description: string; values: readonly string[] };

export interface InputSpec {
  fields: Record<string, Field>;
  required: readonly string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function jsonSchema(spec: InputSpec): {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
} {
  const properties = Object.fromEntries(
    Object.entries(spec.fields).map(([name, field]) => {
      const description = field.description;
      switch (field.type) {
        case 'text':
          return [name, { type: 'string', description, maxLength: field.max }];
        case 'uuid':
          return [name, { type: 'string', description, format: 'uuid' }];
        case 'date':
          return [name, { type: 'string', description, format: 'date' }];
        case 'boolean':
          return [name, { type: 'boolean', description }];
        case 'enum':
          return [name, { type: 'string', description, enum: [...field.values] }];
      }
    }),
  );
  return { type: 'object', properties, required: [...spec.required], additionalProperties: false };
}

export type InputCheck =
  | { ok: true; value: Record<string, string | boolean> }
  | { ok: false; error: string };

export function validateInput(spec: InputSpec, input: unknown): InputCheck {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'A entrada precisa ser um objeto.' };
  }
  const value: Record<string, string | boolean> = {};
  for (const [name, raw] of Object.entries(input)) {
    const field = spec.fields[name];
    if (!field) return { ok: false, error: `Campo desconhecido: ${name}.` };
    if (raw === null || raw === undefined || raw === '') continue;
    if (field.type === 'boolean') {
      if (typeof raw !== 'boolean') return { ok: false, error: `${name} precisa ser true ou false.` };
      value[name] = raw;
      continue;
    }
    if (typeof raw !== 'string') return { ok: false, error: `${name} precisa ser texto.` };
    const text = raw.trim();
    if (field.type === 'text' && text.length > field.max) {
      return { ok: false, error: `${name} passa de ${field.max} caracteres.` };
    }
    if (field.type === 'uuid' && !UUID.test(text)) return { ok: false, error: `${name} não é um id válido.` };
    if (field.type === 'date' && !validDate(text)) return { ok: false, error: `${name} precisa ser uma data AAAA-MM-DD.` };
    if (field.type === 'enum' && !field.values.includes(text)) {
      return { ok: false, error: `${name} precisa ser um de: ${field.values.join(', ')}.` };
    }
    if (text) value[name] = text;
  }
  const missing = spec.required.filter((name) => value[name] === undefined);
  if (missing.length) return { ok: false, error: `Faltou: ${missing.join(', ')}.` };
  return { ok: true, value };
}
