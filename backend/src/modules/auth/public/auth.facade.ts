import type { UserPermissions } from '../domain/permissions.js';

export type {
  AccessLevel,
  BudgetAccess,
  PermissionFlags,
  PermissionModule,
  UserPermissions,
} from '../domain/permissions.js';

/** Token de injeção da fachada do módulo auth. */
export const AUTH_FACADE = Symbol('AUTH_FACADE');

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  color: string | null;
  avatarFileId: string | null;
  active: boolean;
}

export interface TeamSummary {
  id: string;
  name: string;
  userIds: string[];
}

/**
 * Interface pública do módulo auth: o que os outros módulos podem usar.
 * Dados de RH (salário, banco, PIX) não saem por aqui.
 */
export interface AuthFacade {
  getUsers(ids: string[]): Promise<UserSummary[]>;
  getPermissions(userId: string): Promise<UserPermissions | null>;
  /** Valor/hora atual do colaborador ligado ao usuário (custo de horas). */
  getHourlyRate(userId: string): Promise<number | null>;
  /** Equipes ativas com os seus membros (filtros de pautas e relatórios). */
  getTeams(): Promise<TeamSummary[]>;
}
