/** Validação de CPF e CNPJ (dígitos verificadores). */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function allSameDigit(digits: string): boolean {
  return /^(\d)\1*$/.test(digits);
}

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || allSameDigit(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || allSameDigit(digits)) return false;
  const check = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** CPF para pessoa física, CNPJ para jurídica. */
export function isValidDocument(value: string, personType: 'PF' | 'PJ'): boolean {
  return personType === 'PF' ? isValidCpf(value) : isValidCnpj(value);
}
