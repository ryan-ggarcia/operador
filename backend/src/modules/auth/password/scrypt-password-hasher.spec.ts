import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('confere a senha certa e recusa a errada', async () => {
    const stored = await hasher.hash('senha-forte-123');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(hasher.verify('senha-forte-123', stored)).resolves.toBe(true);
    await expect(hasher.verify('outra-senha', stored)).resolves.toBe(false);
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const first = await hasher.hash('mesma-senha');
    const second = await hasher.hash('mesma-senha');
    expect(first).not.toBe(second);
  });

  it('recusa formato desconhecido', async () => {
    await expect(hasher.verify('x', 'bcrypt$abc')).resolves.toBe(false);
  });
});
