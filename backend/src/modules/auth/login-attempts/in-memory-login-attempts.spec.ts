import { InMemoryLoginAttempts } from './in-memory-login-attempts.js';

const MINUTE = 60 * 1000;

describe('InMemoryLoginAttempts', () => {
  let now: number;
  let attempts: InMemoryLoginAttempts;

  beforeEach(() => {
    now = 0;
    attempts = new InMemoryLoginAttempts(() => now);
  });

  it('conta até o limite e depois recusa sem renovar a validade', async () => {
    for (let i = 0; i < 3; i++) expect(await attempts.take('k', 3, 15 * MINUTE)).toBe(true);
    now = 14 * MINUTE;
    expect(await attempts.take('k', 3, 15 * MINUTE)).toBe(false);
    now = 15 * MINUTE;
    expect(await attempts.take('k', 3, 15 * MINUTE)).toBe(true);
  });

  it('reset zera a contagem', async () => {
    await attempts.take('k', 2, MINUTE);
    await attempts.take('k', 2, MINUTE);
    await attempts.reset('k');
    expect(await attempts.take('k', 2, MINUTE)).toBe(true);
  });

  it('limpa as entradas vencidas', async () => {
    await attempts.take('a', 3, MINUTE);
    await attempts.take('b', 3, MINUTE);
    now = 2 * MINUTE;
    await attempts.take('c', 3, MINUTE);
    expect(attempts.size).toBe(1);
  });
});
