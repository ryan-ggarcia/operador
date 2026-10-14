import { canEditOwn, FULL, READ_ALL, type UserPermissions } from '../../auth/public/index.js';

/** Quem pode o quê numa mídia (permissão `medias`, níveis do Operand). */

export interface MediaAccessView {
  situation: 'OPEN' | 'DONE' | 'CANCELED';
  responsibleId: string | null;
  requesterId: string | null;
  memberIds: string[];
  sentToFinanceAt: Date | null;
}

export function isMediaInvolved(userId: string, media: MediaAccessView): boolean {
  return media.responsibleId === userId || media.requesterId === userId || media.memberIds.includes(userId);
}

/** Nível 1 vê só as mídias em que está envolvido; 2 ou mais vê todas. */
export function canViewMedia(userId: string, access: UserPermissions, media: MediaAccessView): boolean {
  const level = access.modules.medias;
  if (level === 0) return false;
  return level >= READ_ALL || isMediaInvolved(userId, media);
}

export function canCreateMedia(access: UserPermissions): boolean {
  return canEditOwn(access.modules.medias);
}

/** Concluir, cancelar e reabrir: níveis 1 e 3 só quando envolvido. */
export function canActOnMedia(userId: string, access: UserPermissions, media: MediaAccessView): boolean {
  if (!canViewMedia(userId, access, media)) return false;
  const level = access.modules.medias;
  return canEditOwn(level) && (level >= FULL || isMediaInvolved(userId, media));
}

/**
 * Editar exige mídia aberta e ainda não enviada ao financeiro (enviada fica
 * travada até reabrir as faturas).
 */
export function canEditMedia(userId: string, access: UserPermissions, media: MediaAccessView): boolean {
  return media.situation === 'OPEN' && media.sentToFinanceAt === null && canActOnMedia(userId, access, media);
}

export function nextMediaSituation(
  current: MediaAccessView['situation'],
  action: 'complete' | 'cancel' | 'reopen',
): MediaAccessView['situation'] | null {
  if (action === 'reopen') return current === 'OPEN' ? null : 'OPEN';
  if (current !== 'OPEN') return null;
  return action === 'complete' ? 'DONE' : 'CANCELED';
}

/** Próxima letra livre para peça: A, B, …, Z, AA, AB… */
export function nextPieceLetter(used: string[]): string {
  const taken = new Set(used.map((letter) => letter.toUpperCase()));
  for (let index = 0; ; index++) {
    let letter = '';
    let value = index;
    do {
      letter = String.fromCharCode(65 + (value % 26)) + letter;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    if (!taken.has(letter)) return letter;
  }
}
