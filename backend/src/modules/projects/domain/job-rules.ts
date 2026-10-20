import {
  ADMIN,
  canEditOwn,
  FULL,
  READ_ALL,
  type UserPermissions,
} from '../../auth/public/index.js';

/** Regras de jobs e tarefas (docs/operand/jobs.md, 4, 5 e 7). */

export type JobSituation = 'OPEN' | 'DONE' | 'CANCELED';
export type JobAction = 'complete' | 'cancel' | 'reopen';

export interface JobAccessView {
  situation: JobSituation;
  responsibleId: string | null;
  requesterId: string | null;
  memberIds: string[];
  projectHidden: boolean;
  /** O usuário é envolvido no projeto do job. */
  involvedInProject: boolean;
}

export function isJobInvolved(userId: string, job: JobAccessView): boolean {
  return (
    job.responsibleId === userId ||
    job.requesterId === userId ||
    job.memberIds.includes(userId)
  );
}

/**
 * Nível 1 vê só os jobs em que está envolvido (a "Minha pauta"); nível 2 ou
 * mais vê todos, menos os de projeto oculto, que ficam para os envolvidos
 * (no job ou no projeto) e para o administrador do módulo.
 */
export function canViewJob(userId: string, access: UserPermissions, job: JobAccessView): boolean {
  const level = access.modules.jobs;
  if (level === 0) return false;
  const involved = isJobInvolved(userId, job);
  if (job.projectHidden && !involved && !job.involvedInProject && level < ADMIN) return false;
  return level >= READ_ALL || involved;
}

export function canCreateJob(access: UserPermissions): boolean {
  return canEditOwn(access.modules.jobs);
}

/** Alterar exige job aberto; níveis 1 e 3 só quando envolvido. */
export function canEditJob(userId: string, access: UserPermissions, job: JobAccessView): boolean {
  if (job.situation !== 'OPEN') return false;
  return canActOnJob(userId, access, job);
}

/** Concluir, cancelar e reabrir: mesmas regras de edição, sem exigir aberto. */
export function canActOnJob(userId: string, access: UserPermissions, job: JobAccessView): boolean {
  if (!canViewJob(userId, access, job)) return false;
  const level = access.modules.jobs;
  if (!canEditOwn(level)) return false;
  return level >= FULL || isJobInvolved(userId, job);
}

export function nextJobSituation(current: JobSituation, action: JobAction): JobSituation | null {
  switch (action) {
    case 'complete':
      return current === 'OPEN' ? 'DONE' : null;
    case 'cancel':
      return current === 'OPEN' ? 'CANCELED' : null;
    case 'reopen':
      return current === 'OPEN' ? null : 'OPEN';
  }
}

/**
 * Atraso: prazo vencido com o documento aberto, exceto quando o status está
 * marcado como "não conta atraso". O prazo sem hora já é gravado como o fim
 * do dia no fuso da agência.
 */
export function isOverdue(
  item: { situation: JobSituation; deadline: Date | null },
  statusIgnoresDelay: boolean,
  now: Date,
): boolean {
  if (item.situation !== 'OPEN' || !item.deadline || statusIgnoresDelay) return false;
  return item.deadline.getTime() < now.getTime();
}

/** Número exibido do documento: <número do projeto>.<sequência>. */
export function documentNumber(projectNumber: number, sequence: number): string {
  return `${projectNumber}.${sequence}`;
}

/** O prazo não pode ser antes do início. */
export function isValidSchedule(startAt: Date | null, deadline: Date | null): boolean {
  return !startAt || !deadline || startAt.getTime() <= deadline.getTime();
}
