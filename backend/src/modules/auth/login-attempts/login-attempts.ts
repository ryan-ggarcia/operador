export const LOGIN_ATTEMPTS = Symbol('LOGIN_ATTEMPTS');

/** Contador de tentativas de login por chave, com validade. */
export interface LoginAttempts {
  /**
   * Conta uma tentativa. Se a chave já tem `limit` tentativas dentro da
   * validade, devolve false e não conta (nem renova a validade); senão conta
   * e renova a validade para `windowMs` a partir de agora.
   */
  take(key: string, limit: number, windowMs: number): Promise<boolean>;
  /** Zera a contagem da chave (login certo). */
  reset(key: string): Promise<void>;
}
