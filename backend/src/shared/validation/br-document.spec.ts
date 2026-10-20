import { isValidCnpj, isValidCpf, isValidDocument, onlyDigits } from './br-document.js';

describe('CPF e CNPJ', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
  });

  it('recusa CPF com dígito errado, repetido ou tamanho errado', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('1234')).toBe(false);
  });

  it('aceita CNPJ válido e recusa inválido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('escolhe a regra pelo tipo de pessoa', () => {
    expect(isValidDocument('52998224725', 'PF')).toBe(true);
    expect(isValidDocument('52998224725', 'PJ')).toBe(false);
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });
});
