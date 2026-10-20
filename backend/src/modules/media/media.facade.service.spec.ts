import { ForbiddenException } from '@nestjs/common';
import { makePermissions } from '../auth/public/testing.js';
import { MediaFacadeService } from './media.facade.service.js';
import type { MediasService } from './medias/medias.service.js';

const item = (situation: string, grossTotal: number, netValue: number) => ({
  id: situation, number: '1.1', title: 'PI', mediaType: 'TV', client: null, vehicle: null, project: null,
  responsible: null, situation, deadline: null, grossTotal, netValue, sentToFinanceAt: null, createdAt: new Date(),
});

describe('MediaFacadeService: busca para o assistente', () => {
  const list = vi.fn(async () => ({ total: 2, items: [item('OPEN', 100.1, 80.05), item('CANCELED', 50, 40)] }));
  const settings = { getAgency: async () => ({ timezone: 'America/Sao_Paulo' }) };
  const facade = new MediaFacadeService({} as never, settings as never, { list } as unknown as MediasService);

  it('sem acesso a mídias não consulta', async () => {
    await expect(facade.searchMediasForUser('u1', makePermissions({ jobs: 7 }), {})).rejects.toThrow(ForbiddenException);
    expect(list).not.toHaveBeenCalled();
  });

  it('período no fuso da agência e totais sem as canceladas', async () => {
    const result = await facade.searchMediasForUser('u1', makePermissions({ medias: 2 }), {
      createdFrom: '2026-10-01',
      createdTo: '2026-10-31',
    });
    expect(list).toHaveBeenCalledWith('u1', expect.anything(), expect.objectContaining({
      createdFrom: new Date('2026-10-01T03:00:00.000Z'),
      createdTo: new Date('2026-11-01T02:59:59.999Z'),
    }));
    expect(result.totals).toEqual({ grossTotal: 100.1, netValue: 80.05, counted: 1 });
    await expect(facade.searchMediasForUser('u1', makePermissions({ medias: 2 }), { createdTo: '31/10/2026' }))
      .rejects.toThrow('Data inválida');
  });
});
