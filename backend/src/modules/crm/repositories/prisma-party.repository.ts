import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { PartyRecord, PartyRepository } from './party.repository.js';

@Injectable()
export class PrismaPartyRepository implements PartyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIds(ids: string[]): Promise<PartyRecord[]> {
    return this.prisma.party.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        document: true,
        isClient: true,
        isSupplier: true,
        isProvider: true,
        isVehicle: true,
        active: true,
      },
    });
  }
}
