import { CrmFacadeService } from './crm.facade.service.js';
import type {
  PartyRecord,
  PartyRepository,
} from './repositories/party.repository.js';

const party = (overrides: Partial<PartyRecord>): PartyRecord => ({
  id: 'p1',
  name: 'Cliente Exemplo',
  document: null,
  isClient: false,
  isSupplier: false,
  isProvider: false,
  isVehicle: false,
  active: true,
  ...overrides,
});

describe('CrmFacadeService', () => {
  const records = [
    party({ id: 'p1', isClient: true, isSupplier: true }),
    party({ id: 'p2', name: 'Veículo Exemplo', isVehicle: true }),
  ];
  const repository: PartyRepository = {
    findByIds: async (ids) => records.filter((record) => ids.includes(record.id)),
  };
  const facade = new CrmFacadeService(repository);

  it('devolve os papéis acumulados da pessoa', async () => {
    const result = await facade.getParty('p1');
    expect(result?.roles).toEqual(['client', 'supplier']);
  });

  it('busca em lote, sem repetir ids', async () => {
    const result = await facade.getParties(['p1', 'p2', 'p1']);
    expect(result.map((item) => item.id)).toEqual(['p1', 'p2']);
  });

  it('id inexistente devolve nulo', async () => {
    await expect(facade.getParty('x')).resolves.toBeNull();
  });
});
