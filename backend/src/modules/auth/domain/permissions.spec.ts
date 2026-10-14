import {
  hasAnyModuleAccess,
  hasLevel,
  normalizeStoredPermissions,
  resolvePermissions,
} from './permissions.js';

describe('resolvePermissions', () => {
  const profile = {
    modules: { jobs: 3, medias: 3, projects: 6 },
    flags: { projectBudget: 'view' as const },
  };

  it('usa o perfil quando não há personalização', () => {
    const permissions = resolvePermissions(profile, null);
    expect(permissions.modules.jobs).toBe(3);
    expect(permissions.modules.projects).toBe(6);
    expect(permissions.flags.projectBudget).toBe('view');
  });

  it('a personalização substitui o perfil inteiro', () => {
    const permissions = resolvePermissions(profile, { modules: { jobs: 1 } });
    expect(permissions.modules.jobs).toBe(1);
    expect(permissions.modules.projects).toBe(0);
    expect(permissions.flags.projectBudget).toBe('none');
  });

  it('módulo ausente ou nível inválido vale sem acesso', () => {
    const permissions = resolvePermissions(
      { modules: { jobs: 5, financial: 'x' as unknown as number } },
      null,
    );
    expect(permissions.modules.jobs).toBe(0);
    expect(permissions.modules.financial).toBe(0);
    expect(permissions.modules.clients).toBe(0);
  });

  it('o dono da conta é sempre administrador', () => {
    expect(resolvePermissions(profile, null, true).flags.administrator).toBe(true);
    expect(resolvePermissions(profile, null).flags.administrator).toBe(false);
  });

  it('sem perfil nem personalização, nenhum acesso', () => {
    const permissions = resolvePermissions(null, null);
    expect(hasAnyModuleAccess(permissions)).toBe(false);
    expect(permissions.flags.hiddenProjects).toBe(false);
  });
});

describe('normalizeStoredPermissions', () => {
  it('descarta módulos e níveis desconhecidos e flags com tipo errado', () => {
    const result = normalizeStoredPermissions({
      modules: { jobs: 6, projects: 4, inventado: 7, clients: 0 },
      flags: { hiddenProjects: 'sim', administrator: true, projectBudget: 'edit' },
    });
    expect(result).toEqual({
      modules: { jobs: 6 },
      flags: { administrator: true, projectBudget: 'edit' },
    });
  });

  it('aceita vazio', () => {
    expect(normalizeStoredPermissions(null)).toEqual({ modules: {}, flags: {} });
  });
});

describe('hasLevel', () => {
  it('compara o nível do módulo com o mínimo', () => {
    const permissions = resolvePermissions({ modules: { jobs: 3 } }, null);
    expect(hasLevel(permissions, 'jobs', 2)).toBe(true);
    expect(hasLevel(permissions, 'jobs', 6)).toBe(false);
    expect(hasAnyModuleAccess(permissions)).toBe(true);
  });
});
