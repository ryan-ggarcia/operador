import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MEDIA_CATALOG_REPOSITORY,
  type MarketRecord,
  type MediaCatalogRepository,
  type MediaType,
  type NamedItem,
  type NetworkRecord,
  type ProgramRecord,
  type StatusRecord,
} from '../repositories/media.repository.js';

/** Redes, praças, programas, métricas de custo e status de mídia. */
@Injectable()
export class MediaCatalogService {
  constructor(
    @Inject(MEDIA_CATALOG_REPOSITORY) private readonly catalog: MediaCatalogRepository,
  ) {}

  listNetworks(): Promise<NetworkRecord[]> {
    return this.catalog.listNetworks();
  }

  /** Rede em uso não muda de mnemônico. */
  async saveNetwork(id: string | null, data: Omit<NetworkRecord, 'id'>): Promise<NetworkRecord> {
    const mnemonic = data.mnemonic.trim().toUpperCase();
    if (!data.name.trim() || !mnemonic) throw new BadRequestException('Informe o nome e o mnemônico da rede.');
    if (await this.catalog.networkMnemonicInUse(mnemonic, id ?? undefined)) {
      throw new ConflictException('Já existe uma rede com este mnemônico.');
    }
    if (id) {
      const current = await this.catalog.findNetwork(id);
      if (!current) throw new NotFoundException('Rede não encontrada.');
      if (current.mnemonic !== mnemonic && (await this.catalog.networkInUse(id))) {
        throw new BadRequestException('A rede está em uso: o mnemônico não pode mudar.');
      }
    }
    return this.catalog.saveNetwork(id, { ...data, name: data.name.trim(), mnemonic });
  }

  listMarkets(): Promise<MarketRecord[]> {
    return this.catalog.listMarkets();
  }

  async saveMarket(id: string | null, data: Omit<MarketRecord, 'id'>): Promise<MarketRecord> {
    if (!data.name.trim()) throw new BadRequestException('Informe o nome da praça.');
    if (id && !(await this.catalog.findMarket(id))) throw new NotFoundException('Praça não encontrada.');
    return this.catalog.saveMarket(id, {
      ...data,
      name: data.name.trim(),
      abbreviation: data.abbreviation?.trim() || null,
      state: data.state ? data.state.trim().toUpperCase() : null,
    });
  }

  listPrograms(filter: { networkId?: string; mediaType?: MediaType }): Promise<ProgramRecord[]> {
    return this.catalog.listPrograms(filter);
  }

  /** Programa de TV ou rádio: mnemônico único na rede; dias em que vai ao ar. */
  async saveProgram(id: string | null, data: Omit<ProgramRecord, 'id'>): Promise<ProgramRecord> {
    if (data.mediaType !== 'TV' && data.mediaType !== 'RADIO') {
      throw new BadRequestException('Programa é só de TV ou rádio.');
    }
    if (!(await this.catalog.findNetwork(data.networkId))) throw new BadRequestException('Rede não encontrada.');
    const mnemonic = data.mnemonic.trim().toUpperCase();
    if (!data.name.trim() || !mnemonic) throw new BadRequestException('Informe o nome e o mnemônico do programa.');
    if (await this.catalog.programMnemonicInUse(data.networkId, mnemonic, id ?? undefined)) {
      throw new ConflictException('Já existe um programa com este mnemônico nesta rede.');
    }
    const airingDays = [...new Set(data.airingDays)].sort();
    if (airingDays.length === 0 || airingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new BadRequestException('Marque os dias em que o programa vai ao ar.');
    }
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if ((data.startTime && !time.test(data.startTime)) || (data.endTime && !time.test(data.endTime))) {
      throw new BadRequestException('Horário inválido (use HH:MM).');
    }
    if (id && !(await this.catalog.findProgram(id))) throw new NotFoundException('Programa não encontrado.');
    return this.catalog.saveProgram(id, { ...data, name: data.name.trim(), mnemonic, airingDays });
  }

  listCostMetrics(): Promise<NamedItem[]> {
    return this.catalog.listCostMetrics();
  }

  async saveCostMetric(id: string | null, data: { name: string; active: boolean }): Promise<NamedItem> {
    if (!data.name.trim()) throw new BadRequestException('Informe o nome.');
    if (id && !(await this.catalog.findCostMetric(id))) throw new NotFoundException('Métrica não encontrada.');
    return this.catalog.saveCostMetric(id, { ...data, name: data.name.trim().toUpperCase() });
  }

  listStatuses(includeInactive: boolean): Promise<StatusRecord[]> {
    return this.catalog.listStatuses(includeInactive);
  }

  async saveStatus(id: string | null, data: Omit<StatusRecord, 'id' | 'order'>): Promise<StatusRecord> {
    if (!data.name.trim()) throw new BadRequestException('Informe o nome do status.');
    if (id && !(await this.catalog.findStatus(id))) throw new NotFoundException('Status não encontrado.');
    return this.catalog.saveStatus(id, { ...data, name: data.name.trim() });
  }
}
