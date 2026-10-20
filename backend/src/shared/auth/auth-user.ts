/** Conteúdo do token de acesso (JWT). */
export interface AccessTokenPayload {
  /** Id do usuário. */
  sub: string;
  /** Versão das permissões do usuário quando o token foi emitido. */
  pv: number;
  /** Presente quando o usuário ainda precisa trocar a senha provisória. */
  mcp?: true;
}

/** Usuário autenticado, disponível em request.user. */
export interface AuthUser {
  id: string;
  permissionsVersion: number;
}
