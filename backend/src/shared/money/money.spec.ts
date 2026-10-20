import { amountOf, fromCents, percentOf, splitCents, toCents } from './money.js';

describe('dinheiro em centavos', () => {
  it('converte e calcula percentual sem erro de ponto flutuante', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(fromCents(1999)).toBe(19.99);
    expect(percentOf(10_000, 20)).toBe(2_000);
    expect(percentOf(333, 33.3333)).toBe(111);
  });

  it('valor por % ou fixo', () => {
    expect(amountOf(50_000, 'PERCENT', 10)).toBe(5_000);
    expect(amountOf(50_000, 'AMOUNT', 12.34)).toBe(1_234);
  });

  it('divide em parcelas e a sobra vai para a última', () => {
    expect(splitCents(10_000, 3)).toEqual([3_333, 3_333, 3_334]);
    expect(splitCents(10_000, 1)).toEqual([10_000]);
    expect(() => splitCents(100, 0)).toThrow();
  });
});
