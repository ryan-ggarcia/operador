import { canEditOwn, FULL, READ_ALL, type UserPermissions } from '../../auth/public/index.js';

/** Quem pode o quê numa produção (permissão `productions`, níveis do Operand). */

export interface ProductionAccessView {
  situation: 'OPEN' | 'DONE' | 'CANCELED';
  responsibleId: string | null;
  requesterId: string | null;
  memberIds: string[];
}

export function isProductionInvolved(userId: string, production: ProductionAccessView): boolean {
  return production.responsibleId === userId || production.requesterId === userId || production.memberIds.includes(userId);
}

/** Nível 1 vê só as produções em que está envolvido; 2 ou mais vê todas. */
export function canViewProduction(userId: string, access: UserPermissions, production: ProductionAccessView): boolean {
  const level = access.modules.productions;
  if (level === 0) return false;
  return level >= READ_ALL || isProductionInvolved(userId, production);
}

export function canCreateProduction(access: UserPermissions): boolean {
  return canEditOwn(access.modules.productions);
}

/** Concluir, cancelar e reabrir: níveis 1 e 3 só quando envolvido. */
export function canActOnProduction(userId: string, access: UserPermissions, production: ProductionAccessView): boolean {
  if (!canViewProduction(userId, access, production)) return false;
  const level = access.modules.productions;
  return canEditOwn(level) && (level >= FULL || isProductionInvolved(userId, production));
}

/**
 * Editar exige produção aberta. O envio ao financeiro trava só os itens do
 * fornecedor enviado (ver isSupplierLocked no service).
 */
export function canEditProduction(userId: string, access: UserPermissions, production: ProductionAccessView): boolean {
  return production.situation === 'OPEN' && canActOnProduction(userId, access, production);
}

export function nextProductionSituation(
  current: ProductionAccessView['situation'],
  action: 'complete' | 'cancel' | 'reopen',
): ProductionAccessView['situation'] | null {
  if (action === 'reopen') return current === 'OPEN' ? null : 'OPEN';
  if (current !== 'OPEN') return null;
  return action === 'complete' ? 'DONE' : 'CANCELED';
}
