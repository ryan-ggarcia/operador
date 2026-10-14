// Ajuda para os testes dos outros módulos montarem permissões.
import {
  resolvePermissions,
  type PermissionFlags,
  type UserPermissions,
} from '../domain/permissions.js';

export function makePermissions(
  modules: Record<string, number>,
  flags: Partial<PermissionFlags> = {},
): UserPermissions {
  return resolvePermissions({ modules, flags }, null);
}
