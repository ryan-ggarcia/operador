import { resolvePermissions } from '../domain/permissions.js';
import { meetsRequirement } from './access.js';

describe('meetsRequirement', () => {
  const permissions = resolvePermissions(
    { modules: { jobs: 3, projects: 1 } },
    null,
  );

  it('basta um dos módulos atingir o nível', () => {
    expect(
      meetsRequirement(permissions, { kind: 'module', modules: ['projects', 'jobs'], minimum: 2 }),
    ).toBe(true);
    expect(
      meetsRequirement(permissions, { kind: 'module', modules: ['projects'], minimum: 2 }),
    ).toBe(false);
  });

  it('administrador depende da flag', () => {
    expect(meetsRequirement(permissions, { kind: 'administrator' })).toBe(false);
    const owner = resolvePermissions(null, null, true);
    expect(meetsRequirement(owner, { kind: 'administrator' })).toBe(true);
  });
});
