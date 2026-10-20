import { BadRequestException } from '@nestjs/common';
import type { Agency } from './public/settings.facade.js';
import type { AgencyRepository } from './repositories/agency.repository.js';
import { DEFAULT_AGENCY, SettingsService } from './settings.service.js';

class MemoryAgencyRepository implements AgencyRepository {
  stored: Agency | null = null;
  async find() {
    return this.stored;
  }
  async save(data: Agency) {
    this.stored = data;
    return data;
  }
}

describe('SettingsService', () => {
  let repository: MemoryAgencyRepository;
  let service: SettingsService;

  beforeEach(() => {
    repository = new MemoryAgencyRepository();
    service = new SettingsService(repository);
  });

  it('sem cadastro, devolve os padrões da agência', async () => {
    await expect(service.getAgency()).resolves.toEqual(DEFAULT_AGENCY);
  });

  it('grava com CNPJ só com dígitos', async () => {
    const agency = await service.updateAgency({
      legalName: ' Agência Exemplo Ltda ',
      tradeName: 'Exemplo',
      cnpj: '11.222.333/0001-81',
    });
    expect(agency.cnpj).toBe('11222333000181');
    expect(agency.legalName).toBe('Agência Exemplo Ltda');
    expect(repository.stored?.timezone).toBe('America/Sao_Paulo');
  });

  it('recusa CNPJ inválido, nomes vazios e fuso desconhecido', async () => {
    await expect(
      service.updateAgency({ legalName: 'A', tradeName: 'B', cnpj: '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateAgency({ legalName: '', tradeName: 'B' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateAgency({ legalName: 'A', tradeName: 'B', timezone: 'Lua/Base' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
