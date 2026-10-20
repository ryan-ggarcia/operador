import type { LoginAttempts } from './login-attempts.js';

const SWEEP_INTERVAL_MS = 60 * 1000;

// shortcut: contagem em memória, zera ao reiniciar e vale só com uma instância; trocar por armazenamento compartilhado se houver mais de uma
export class InMemoryLoginAttempts implements LoginAttempts {
  private readonly entries = new Map<string, { count: number; expiresAt: number }>();
  private nextSweepAt = 0;

  constructor(private readonly now: () => number = Date.now) {}

  // Sem await antes de gravar: ler e contar acontece de uma vez, então
  // tentativas em paralelo não passam do limite.
  async take(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = this.now();
    this.sweep(now);
    const entry = this.entries.get(key);
    const count = entry && entry.expiresAt > now ? entry.count : 0;
    if (count >= limit) return false;
    this.entries.set(key, { count: count + 1, expiresAt: now + windowMs });
    return true;
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** Apaga as entradas vencidas, no máximo uma vez por minuto. */
  private sweep(now: number): void {
    if (now < this.nextSweepAt) return;
    this.nextSweepAt = now + SWEEP_INTERVAL_MS;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  /** Quantas chaves estão guardadas (para teste). */
  get size(): number {
    return this.entries.size;
  }
}
