import { TtlCache } from './ttl-cache.js';

describe('TtlCache', () => {
  it('devolve o valor dentro da validade e esquece depois', () => {
    let now = 1000;
    const cache = new TtlCache<number>(100, () => now);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    now = 1099;
    expect(cache.get('a')).toBe(1);
    now = 1100;
    expect(cache.get('a')).toBeUndefined();
  });

  it('delete e clear removem as entradas', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    cache.clear();
    expect(cache.get('b')).toBeUndefined();
  });
});
