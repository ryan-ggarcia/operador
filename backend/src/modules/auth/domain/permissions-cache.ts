import type { UserPermissions } from './permissions.js';
import { TtlCache } from './ttl-cache.js';

export const PERMISSIONS_CACHE = Symbol('PERMISSIONS_CACHE');

/** Permissões efetivas por usuário, por alguns segundos. */
export type PermissionsCache = TtlCache<UserPermissions>;

export const PERMISSIONS_CACHE_TTL_MS = 30_000;
