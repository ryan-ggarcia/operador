import { Transform } from 'class-transformer';

/** Converte "true"/"false" da query string em booleano. */
export const ToBoolean = () =>
  Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  );

/** Aceita "a,b,c" ou parâmetro repetido e devolve uma lista. */
export const ToArray = () =>
  Transform(({ value }) =>
    value == null
      ? value
      : (Array.isArray(value) ? value : String(value).split(','))
          .map((item) => String(item).trim())
          .filter(Boolean),
  );

/** Tira espaços das pontas e caracteres de controle. */
export const Trim = () =>
  Transform(({ value }) =>
    typeof value === 'string'
      ? // eslint-disable-next-line no-control-regex
        value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
      : value,
  );
