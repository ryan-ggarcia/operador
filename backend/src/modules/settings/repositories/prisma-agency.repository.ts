import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Agency, AgencyAddress } from '../public/settings.facade.js';
import type { AgencyRepository } from './agency.repository.js';

type AgencyRow = Prisma.AgencyGetPayload<object>;

function toAgency({ id, updatedAt, address, ...row }: AgencyRow): Agency {
  void id;
  void updatedAt;
  return { ...row, address: (address as AgencyAddress | null) ?? null };
}

@Injectable()
export class PrismaAgencyRepository implements AgencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(): Promise<Agency | null> {
    const row = await this.prisma.agency.findFirst();
    return row ? toAgency(row) : null;
  }

  async save(data: Agency): Promise<Agency> {
    const { address, ...rest } = data;
    const values = {
      ...rest,
      address: address ? (address as Prisma.InputJsonValue) : Prisma.DbNull,
    };
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.agency.findFirst({ select: { id: true } });
      return current
        ? tx.agency.update({ where: { id: current.id }, data: values })
        : tx.agency.create({ data: values });
    });
    return toAgency(row);
  }
}
