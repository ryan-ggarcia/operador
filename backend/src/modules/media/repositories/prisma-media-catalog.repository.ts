import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  MarketRecord,
  MediaCatalogRepository,
  MediaType,
  NamedItem,
  NetworkRecord,
  ProgramRecord,
  StatusRecord,
} from './media.repository.js';

@Injectable()
export class PrismaMediaCatalogRepository implements MediaCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  listNetworks(): Promise<NetworkRecord[]> {
    return this.prisma.network.findMany({ orderBy: { name: 'asc' } });
  }

  findNetwork(id: string): Promise<NetworkRecord | null> {
    return this.prisma.network.findUnique({ where: { id } });
  }

  async networkMnemonicInUse(mnemonic: string, exceptId?: string): Promise<boolean> {
    return (
      (await this.prisma.network.count({
        where: { mnemonic: { equals: mnemonic, mode: 'insensitive' }, id: exceptId ? { not: exceptId } : undefined },
      })) > 0
    );
  }

  async networkInUse(id: string): Promise<boolean> {
    const [medias, programs] = await Promise.all([
      this.prisma.media.count({ where: { networkId: id } }),
      this.prisma.program.count({ where: { networkId: id } }),
    ]);
    return medias + programs > 0;
  }

  saveNetwork(id: string | null, data: Omit<NetworkRecord, 'id'>): Promise<NetworkRecord> {
    return id ? this.prisma.network.update({ where: { id }, data }) : this.prisma.network.create({ data });
  }

  listMarkets(): Promise<MarketRecord[]> {
    return this.prisma.market.findMany({ orderBy: { name: 'asc' } });
  }

  findMarket(id: string): Promise<MarketRecord | null> {
    return this.prisma.market.findUnique({ where: { id } });
  }

  saveMarket(id: string | null, data: Omit<MarketRecord, 'id'>): Promise<MarketRecord> {
    return id ? this.prisma.market.update({ where: { id }, data }) : this.prisma.market.create({ data });
  }

  listPrograms(filter: { networkId?: string; mediaType?: MediaType }): Promise<ProgramRecord[]> {
    return this.prisma.program.findMany({
      where: { networkId: filter.networkId, mediaType: filter.mediaType },
      orderBy: { name: 'asc' },
    });
  }

  findProgram(id: string): Promise<ProgramRecord | null> {
    return this.prisma.program.findUnique({ where: { id } });
  }

  async programMnemonicInUse(networkId: string, mnemonic: string, exceptId?: string): Promise<boolean> {
    return (
      (await this.prisma.program.count({
        where: {
          networkId,
          mnemonic: { equals: mnemonic, mode: 'insensitive' },
          id: exceptId ? { not: exceptId } : undefined,
        },
      })) > 0
    );
  }

  saveProgram(id: string | null, data: Omit<ProgramRecord, 'id'>): Promise<ProgramRecord> {
    return id ? this.prisma.program.update({ where: { id }, data }) : this.prisma.program.create({ data });
  }

  listCostMetrics(): Promise<NamedItem[]> {
    return this.prisma.costMetric.findMany({ orderBy: { name: 'asc' } });
  }

  findCostMetric(id: string): Promise<NamedItem | null> {
    return this.prisma.costMetric.findUnique({ where: { id } });
  }

  saveCostMetric(id: string | null, data: { name: string; active: boolean }): Promise<NamedItem> {
    return id ? this.prisma.costMetric.update({ where: { id }, data }) : this.prisma.costMetric.create({ data });
  }

  listStatuses(includeInactive: boolean): Promise<StatusRecord[]> {
    return this.prisma.mediaStatus.findMany({
      where: { active: includeInactive ? undefined : true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  findStatus(id: string): Promise<StatusRecord | null> {
    return this.prisma.mediaStatus.findUnique({ where: { id } });
  }

  async saveStatus(
    id: string | null,
    data: Omit<StatusRecord, 'id' | 'order'> & { order?: number },
  ): Promise<StatusRecord> {
    if (id) return this.prisma.mediaStatus.update({ where: { id }, data });
    const last = await this.prisma.mediaStatus.aggregate({ _max: { order: true } });
    return this.prisma.mediaStatus.create({ data: { ...data, order: data.order ?? (last._max.order ?? -1) + 1 } });
  }
}
