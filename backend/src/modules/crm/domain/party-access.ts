import type { PermissionModule, UserPermissions } from '../../auth/public/index.js';
import { FULL } from '../../auth/public/index.js';
import type { PartyRole } from '../public/crm.facade.js';

/** Permissão de cada papel (ver docs/operand/cadastros.md, 6). */
export const ROLE_MODULE: Record<PartyRole, PermissionModule> = {
  client: 'clients',
  supplier: 'suppliers',
  provider: 'providers',
  vehicle: 'vehicles',
};

export const PARTY_ROLES = Object.keys(ROLE_MODULE) as PartyRole[];

export const CRM_MODULES = Object.values(ROLE_MODULE);

/** Papéis que o usuário pode ver (nível 1 ou mais). */
export function readableRoles(permissions: UserPermissions): PartyRole[] {
  return PARTY_ROLES.filter((role) => permissions.modules[ROLE_MODULE[role]] > 0);
}

/** Papéis que o usuário pode cadastrar e alterar (nível Total). */
export function writableRoles(permissions: UserPermissions): PartyRole[] {
  return PARTY_ROLES.filter((role) => permissions.modules[ROLE_MODULE[role]] >= FULL);
}

export function canReadParty(permissions: UserPermissions, roles: PartyRole[]): boolean {
  const readable = readableRoles(permissions);
  return roles.some((role) => readable.includes(role));
}

/**
 * Alterar exige nível Total em pelo menos um papel da pessoa; incluir ou
 * tirar um papel exige nível Total nesse papel.
 */
export function canWriteParty(
  permissions: UserPermissions,
  currentRoles: PartyRole[],
  nextRoles: PartyRole[] = currentRoles,
): boolean {
  const writable = writableRoles(permissions);
  if (!currentRoles.some((role) => writable.includes(role))) return false;
  const changed = PARTY_ROLES.filter(
    (role) => currentRoles.includes(role) !== nextRoles.includes(role),
  );
  return changed.every((role) => writable.includes(role));
}
