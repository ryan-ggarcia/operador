import { makePermissions } from '../../auth/public/testing.js';
import {
  canChangeSituation,
  canCreateProject,
  canEditProject,
  canEditSpecialFields,
  canViewProject,
  isLockedSystemProject,
  nextProjectSituation,
  type ProjectAccessView,
} from './project-rules.js';

const project = (overrides: Partial<ProjectAccessView> = {}): ProjectAccessView => ({
  situation: 'OPEN',
  hidden: false,
  isClientDefault: false,
  responsibleId: 'resp',
  requesterId: 'req',
  memberIds: ['membro'],
  ...overrides,
});

describe('regras de projeto', () => {
  const own = makePermissions({ projects: 1 });
  const readAll = makePermissions({ projects: 2 });
  const full = makePermissions({ projects: 6 });
  const admin = makePermissions({ projects: 7 });
  const fullHidden = makePermissions({ projects: 6 }, { hiddenProjects: true });

  it('nível 1 vê só os projetos em que está envolvido; nível 2 vê todos', () => {
    expect(canViewProject('membro', own, project())).toBe(true);
    expect(canViewProject('outro', own, project())).toBe(false);
    expect(canViewProject('outro', readAll, project())).toBe(true);
    expect(canViewProject('outro', makePermissions({}), project())).toBe(false);
  });

  it('projeto oculto: só envolvidos e administradores do módulo veem', () => {
    const hidden = project({ hidden: true });
    expect(canViewProject('outro', full, hidden)).toBe(false);
    expect(canViewProject('membro', readAll, hidden)).toBe(true);
    expect(canViewProject('outro', admin, hidden)).toBe(true);
  });

  it('leitura total não edita; nível 1 e 3 editam se envolvidos; Total edita todos', () => {
    expect(canEditProject('resp', readAll, project())).toBe(false);
    expect(canEditProject('membro', own, project())).toBe(true);
    expect(canEditProject('outro', makePermissions({ projects: 3 }), project())).toBe(false);
    expect(canEditProject('outro', full, project())).toBe(true);
  });

  it('projeto fechado fica somente leitura', () => {
    expect(canEditProject('resp', admin, project({ situation: 'ARCHIVED' }))).toBe(false);
  });

  it('oculto sem a permissão de ocultos: só o administrador edita', () => {
    const hidden = project({ hidden: true });
    expect(canEditProject('resp', full, hidden)).toBe(false);
    expect(canEditProject('resp', fullHidden, hidden)).toBe(true);
    expect(canEditProject('outro', admin, hidden)).toBe(true);
  });

  it('criar projeto oculto exige a permissão de ocultos', () => {
    expect(canCreateProject(full, false)).toBe(true);
    expect(canCreateProject(full, true)).toBe(false);
    expect(canCreateProject(fullHidden, true)).toBe(true);
    expect(canCreateProject(readAll, false)).toBe(false);
  });

  it('campos especiais: responsável ou Total; oculto pede a permissão e responsável ou admin', () => {
    expect(canEditSpecialFields('resp', own, project())).toBe(true);
    expect(canEditSpecialFields('membro', own, project())).toBe(false);
    expect(canEditSpecialFields('membro', full, project())).toBe(true);
    const hidden = project({ hidden: true });
    expect(canEditSpecialFields('outro', fullHidden, hidden)).toBe(false);
    expect(canEditSpecialFields('resp', fullHidden, hidden)).toBe(true);
    expect(canEditSpecialFields('outro', makePermissions({ projects: 7 }, { hiddenProjects: true }), hidden)).toBe(true);
  });

  it('projeto Geral sem responsável fica bloqueado para mudar de situação', () => {
    const locked = project({ isClientDefault: true, responsibleId: null, requesterId: null, memberIds: [] });
    expect(isLockedSystemProject(locked)).toBe(true);
    expect(canChangeSituation('x', admin, locked)).toBe(false);
    expect(isLockedSystemProject(project({ isClientDefault: true }))).toBe(false);
  });

  it('transições de situação ignoram quem já está no destino', () => {
    expect(nextProjectSituation('OPEN', 'archive')).toBe('ARCHIVED');
    expect(nextProjectSituation('CANCELED', 'archive')).toBeNull();
    expect(nextProjectSituation('ARCHIVED', 'cancel')).toBe('CANCELED');
    expect(nextProjectSituation('CANCELED', 'cancel')).toBeNull();
    expect(nextProjectSituation('ARCHIVED', 'reopen')).toBe('OPEN');
    expect(nextProjectSituation('OPEN', 'reopen')).toBeNull();
  });
});
