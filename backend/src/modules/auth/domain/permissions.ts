/**
 * Modelo de permissões herdado do Operand: um nível por módulo, mais algumas
 * permissões extras (ver docs/operand/configuracoes.md, 1.4).
 */

export const PERMISSION_MODULES = [
  'projects',
  'jobs',
  'medias',
  'productions',
  'financial',
  'clients',
  'suppliers',
  'providers',
  'vehicles',
  'employees',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/**
 * 0 sem acesso; 1 registros próprios; 2 leitura total;
 * 3 leitura total + registros próprios; 6 total; 7 administrador.
 */
export const ACCESS_LEVELS = [0, 1, 2, 3, 6, 7] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export type BudgetAccess = 'none' | 'view' | 'edit';

export interface PermissionFlags {
  /** Administra a conta: usuários, perfis, dados da agência. */
  administrator: boolean;
  hiddenProjects: boolean;
  projectBudget: BudgetAccess;
  financialRevenues: boolean;
  financialExpenses: boolean;
  financialTransfers: boolean;
}

export interface UserPermissions {
  modules: Record<PermissionModule, AccessLevel>;
  flags: PermissionFlags;
}

/** Formato gravado em access_profile.permissions e em customPermissions. */
export interface StoredPermissions {
  modules?: Partial<Record<string, number>>;
  flags?: Partial<PermissionFlags>;
}

const NO_FLAGS: PermissionFlags = {
  administrator: false,
  hiddenProjects: false,
  projectBudget: 'none',
  financialRevenues: false,
  financialExpenses: false,
  financialTransfers: false,
};

function toLevel(value: unknown): AccessLevel {
  return (ACCESS_LEVELS as readonly unknown[]).includes(value)
    ? (value as AccessLevel)
    : 0;
}

/**
 * Permissões efetivas do usuário: as personalizadas, se existirem; senão,
 * as do perfil. Módulo ausente ou nível inválido vale "sem acesso". O dono
 * da conta é sempre administrador, para nunca ficar trancado fora.
 */
export function resolvePermissions(
  profile: StoredPermissions | null,
  custom: StoredPermissions | null,
  isOwner = false,
): UserPermissions {
  const source = custom ?? profile ?? {};
  const modules = Object.fromEntries(
    PERMISSION_MODULES.map((module) => [module, toLevel(source.modules?.[module])]),
  ) as Record<PermissionModule, AccessLevel>;
  const flags = { ...NO_FLAGS, ...source.flags };
  if (isOwner) flags.administrator = true;
  return { modules, flags };
}

/** Nível mínimo para ler todos os registros do módulo. */
export const READ_ALL: AccessLevel = 2;
/** Nível mínimo para criar e alterar qualquer registro do módulo. */
export const FULL: AccessLevel = 6;
/** Administrador do módulo. */
export const ADMIN: AccessLevel = 7;

/** Pode alterar registros em que está envolvido (níveis 1, 3, 6 e 7). */
export function canEditOwn(level: AccessLevel): boolean {
  return level !== 0 && level !== 2;
}

const BUDGET_ACCESS: readonly BudgetAccess[] = ['none', 'view', 'edit'];

/**
 * Limpa permissões vindas da API antes de gravar: só módulos e níveis
 * conhecidos, e flags com o tipo certo.
 */
export function normalizeStoredPermissions(input: unknown): StoredPermissions {
  const source = (input ?? {}) as StoredPermissions;
  const modules: Record<string, number> = {};
  for (const module of PERMISSION_MODULES) {
    const level = toLevel(source.modules?.[module]);
    if (level > 0) modules[module] = level;
  }
  const flags: Partial<PermissionFlags> = {};
  const raw = source.flags ?? {};
  for (const key of [
    'administrator',
    'hiddenProjects',
    'financialRevenues',
    'financialExpenses',
    'financialTransfers',
  ] as const) {
    if (raw[key] === true) flags[key] = true;
  }
  if (raw.projectBudget && BUDGET_ACCESS.includes(raw.projectBudget)) {
    if (raw.projectBudget !== 'none') flags.projectBudget = raw.projectBudget;
  }
  return { modules, flags };
}

/** O usuário precisa de acesso a pelo menos um módulo. */
export function hasAnyModuleAccess(permissions: UserPermissions): boolean {
  return Object.values(permissions.modules).some((level) => level > 0);
}

export function hasLevel(
  permissions: UserPermissions,
  module: PermissionModule,
  minimum: AccessLevel,
): boolean {
  return permissions.modules[module] >= minimum;
}
