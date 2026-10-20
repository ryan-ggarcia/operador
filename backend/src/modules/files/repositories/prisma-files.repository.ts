import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { FileRecord, FilesRepository, NewFile } from './files.repository.js';

type FileRow = Prisma.StoredFileGetPayload<object>;

function toRecord(row: FileRow): FileRecord {
  return { ...row, sizeBytes: Number(row.sizeBytes) };
}

@Injectable()
export class PrismaFilesRepository implements FilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listByOwner(ownerType: string, ownerId: string): Promise<FileRecord[]> {
    const rows = await this.prisma.storedFile.findMany({
      where: { ownerType, ownerId, active: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async countByOwners(ownerType: string, ownerIds: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = Object.fromEntries(ownerIds.map((id) => [id, 0]));
    if (ownerIds.length === 0) return result;
    const groups = await this.prisma.storedFile.groupBy({
      by: ['ownerId'],
      where: { ownerType, ownerId: { in: ownerIds }, active: true },
      _count: { _all: true },
    });
    for (const group of groups) result[group.ownerId] = group._count._all;
    return result;
  }

  async findById(id: string): Promise<FileRecord | null> {
    const row = await this.prisma.storedFile.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(files: NewFile[]): Promise<FileRecord[]> {
    const rows = await this.prisma.$transaction(
      files.map((file) => this.prisma.storedFile.create({ data: { ...file, sizeBytes: BigInt(file.sizeBytes) } })),
    );
    return rows.map(toRecord);
  }

  async updateDescription(id: string, description: string | null): Promise<FileRecord> {
    return toRecord(await this.prisma.storedFile.update({ where: { id }, data: { description } }));
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.storedFile.update({ where: { id }, data: { active: false } });
  }

  async usedBytes(): Promise<number> {
    const total = await this.prisma.storedFile.aggregate({ where: { active: true }, _sum: { sizeBytes: true } });
    return Number(total._sum.sizeBytes ?? 0);
  }
}
