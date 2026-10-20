import { makePermissions } from '../../auth/public/testing.js';
import { canReadParty, canWriteParty, readableRoles, writableRoles } from './party-access.js';

describe('acesso a pessoas do crm', () => {
  // Perfil "Mídia" do Operand: clientes 6, veículos 6, fornecedores 0.
  const media = makePermissions({ clients: 6, vehicles: 6 });
  // Perfil "Tráfego": clientes 6, fornecedores e veículos só leitura.
  const traffic = makePermissions({ clients: 6, suppliers: 2, vehicles: 2 });

  it('lê os papéis com nível 1 ou mais e grava com nível Total', () => {
    expect(readableRoles(traffic)).toEqual(['client', 'supplier', 'vehicle']);
    expect(writableRoles(traffic)).toEqual(['client']);
  });

  it('vê a pessoa se puder ver um dos papéis dela', () => {
    expect(canReadParty(media, ['supplier', 'vehicle'])).toBe(true);
    expect(canReadParty(media, ['supplier'])).toBe(false);
  });

  it('altera se tiver Total em um papel; mexer num papel exige Total nele', () => {
    expect(canWriteParty(media, ['client', 'supplier'])).toBe(true);
    expect(canWriteParty(media, ['client'], ['client', 'vehicle'])).toBe(true);
    expect(canWriteParty(media, ['client'], ['client', 'supplier'])).toBe(false);
    expect(canWriteParty(traffic, ['supplier'])).toBe(false);
  });
});
