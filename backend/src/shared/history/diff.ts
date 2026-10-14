/** Uma mudança de campo, para a tabela history de cada módulo. */
export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

function format(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // Decimal do Prisma e outros objetos com toString próprio.
    if ('toFixed' in value && typeof value.toString === 'function') return value.toString();
    return JSON.stringify(value);
  }
  return String(value);
}

/** Campos que mudaram entre o registro atual e a alteração pedida. */
export function diffFields<T extends object>(
  before: T,
  changes: Partial<T>,
  fields: readonly (keyof T & string)[],
): FieldChange[] {
  const result: FieldChange[] = [];
  for (const field of fields) {
    if (!(field in changes) || changes[field] === undefined) continue;
    const oldValue = format(before[field]);
    const newValue = format(changes[field]);
    if (oldValue !== newValue) result.push({ field, oldValue, newValue });
  }
  return result;
}
