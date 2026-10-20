import {
  ADMIN,
  canEditOwn,
  FULL,
  READ_ALL,
  type UserPermissions,
} from '../../auth/public/index.js';

/**
 * Regras de projetos (docs/operand/projetos.md, 4, 5 e 7). Situação
 * (aberto, arquivado, cancelado) é separada do status (etapa configurável).
 */

export type ProjectSituation = 'OPEN' | 'ARCHIVED' | 'CANCELED';
export type ProjectAction = 'archive' | 'cancel' | 'reopen';

export interface ProjectAccessView {
  situation: ProjectSituation;
  hidden: boolean;
  isClientDefault: boolean;
  responsibleId: string | null;
  requesterId: string | null;
  memberIds: string[];
}

/** Envolvido = responsável, solicitante ou membro. */
export function isProjectInvolved(userId: string, project: ProjectAccessView): boolean {
  return (
    project.responsibleId === userId ||
    project.requesterId === userId ||
    project.memberIds.includes(userId)
  );
}

/**
 * Projeto oculto: só os envolvidos e os administradores do módulo veem.
 * Nível 1 vê só os projetos em que está envolvido.
 */
export function canViewProject(
  userId: string,
  access: UserPermissions,
  project: ProjectAccessView,
): boolean {
  const level = access.modules.projects;
  if (level === 0) return false;
  const involved = isProjectInvolved(userId, project);
  if (project.hidden) return involved || level >= ADMIN;
  return level >= READ_ALL || involved;
}

/** Criar projeto: níveis que alteram registros (1, 3, 6, 7). */
export function canCreateProject(access: UserPermissions, hidden: boolean): boolean {
  if (!canEditOwn(access.modules.projects)) return false;
  return !hidden || access.flags.hiddenProjects;
}

/**
 * Alterar exige projeto aberto. Níveis 1 e 3 só nos projetos em que está
 * envolvido; 6 e 7 em todos. Oculto: sem a permissão de ocultos, só o
 * administrador do módulo edita.
 */
export function canEditProject(
  userId: string,
  access: UserPermissions,
  project: ProjectAccessView,
): boolean {
  if (project.situation !== 'OPEN') return false;
  const level = access.modules.projects;
  if (!canEditOwn(level)) return false;
  if (project.hidden && !access.flags.hiddenProjects && level < ADMIN) return false;
  return level >= FULL || isProjectInvolved(userId, project);
}

/**
 * Campos especiais (responsável, oculto): projeto visível exige ser o
 * responsável ou ter nível Total; projeto oculto exige a permissão de
 * ocultos e ser o responsável ou administrador do módulo.
 */
export function canEditSpecialFields(
  userId: string,
  access: UserPermissions,
  project: ProjectAccessView,
): boolean {
  if (project.situation !== 'OPEN') return false;
  const level = access.modules.projects;
  const isResponsible = project.responsibleId === userId;
  if (project.hidden) {
    return access.flags.hiddenProjects && (isResponsible || level >= ADMIN);
  }
  return isResponsible || level >= FULL;
}

/**
 * Projeto "Geral" criado pelo sistema: nasce sem responsável e bloqueado
 * (não arquiva, cancela, reabre nem muda de nome) até alguém desbloquear.
 */
export function isLockedSystemProject(project: ProjectAccessView): boolean {
  return project.isClientDefault && project.responsibleId === null;
}

/** Desbloquear o projeto do sistema exige nível Total. */
export function canUnlockProject(access: UserPermissions): boolean {
  return access.modules.projects >= FULL;
}

/**
 * Próxima situação para a ação, ou null se a ação não se aplica (ações em
 * lote ignoram projetos que já estão no destino).
 */
export function nextProjectSituation(
  current: ProjectSituation,
  action: ProjectAction,
): ProjectSituation | null {
  switch (action) {
    case 'archive':
      return current === 'OPEN' ? 'ARCHIVED' : null;
    case 'cancel':
      return current === 'CANCELED' ? null : 'CANCELED';
    case 'reopen':
      return current === 'OPEN' ? null : 'OPEN';
  }
}

/** Mudar a situação: quem edita o projeto, exceto o projeto bloqueado. */
export function canChangeSituation(
  userId: string,
  access: UserPermissions,
  project: ProjectAccessView,
): boolean {
  if (isLockedSystemProject(project)) return false;
  const level = access.modules.projects;
  if (!canEditOwn(level)) return false;
  if (project.hidden && !access.flags.hiddenProjects && level < ADMIN) return false;
  return level >= FULL || isProjectInvolved(userId, project);
}

export function canViewBudget(access: UserPermissions): boolean {
  return access.flags.projectBudget !== 'none';
}

export function canEditBudget(access: UserPermissions): boolean {
  return access.flags.projectBudget === 'edit';
}
