import { NotFoundException } from '@nestjs/common';
import { makePermissions } from '../../auth/public/testing.js';
import type { ProjectsFacade } from '../../projects/public/index.js';
import type { MediaDetail, MediaFilter, MediaRepository } from '../repositories/media.repository.js';
import { MediasService } from './medias.service.js';

const media = { id: 'm1', projectId: 'oculto', responsibleId: 'resp', requesterId: null, memberIds: [] } as unknown as MediaDetail;

/** Projeto "oculto" é oculto e tem só "envolvido" entre os envolvidos. */
function setup() {
  const filters: MediaFilter[] = [];
  const medias = {
    findById: async () => media,
    list: async (filter: MediaFilter) => (filters.push(filter), { items: [], total: 0 }),
  } as unknown as MediaRepository;
  const projects = {
    getProject: async (id: string) => ({ id, hidden: id === 'oculto' }),
    getProjects: async () => [],
    getHiddenProjectIdsNotInvolving: async (userId: string, ids?: string[]) =>
      userId === 'envolvido' ? [] : (ids ?? ['oculto']).filter((id) => id === 'oculto'),
  } as unknown as ProjectsFacade;
  const empty = { getParties: async () => [], getContacts: async () => [], getUsers: async () => [] };
  const service = new MediasService(medias, {} as never, projects, empty as never, empty as never, {} as never, {} as never, {} as never);
  return { service, filters };
}

describe('MediasService: projeto oculto', () => {
  it('uma mídia de projeto oculto só para envolvidos (mídia ou projeto) e administrador', async () => {
    const { service } = setup();
    await expect(service.requireViewable('outro', makePermissions({ medias: 6 }), 'm1')).rejects.toThrow(NotFoundException);
    await expect(service.requireViewable('envolvido', makePermissions({ medias: 2 }), 'm1')).resolves.toBeTruthy();
    await expect(service.requireViewable('resp', makePermissions({ medias: 2 }), 'm1')).resolves.toBeTruthy();
    await expect(service.requireViewable('outro', makePermissions({ medias: 7 }), 'm1')).resolves.toBeTruthy();
  });

  it('a pauta exclui no banco os projetos ocultos do usuário, menos para administrador e nível 1', async () => {
    const { service, filters } = setup();
    const query = { limit: 10, offset: 0 };
    await service.list('outro', makePermissions({ medias: 6 }), query);
    await service.list('outro', makePermissions({ medias: 7 }), query);
    await service.list('outro', makePermissions({ medias: 1 }), query);
    expect(filters.map((filter) => filter.visibility.hiddenProjectIds)).toEqual([['oculto'], [], []]);
  });
});
