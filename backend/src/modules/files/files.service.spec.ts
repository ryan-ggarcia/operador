import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AuthFacade, UserPermissions } from '../auth/public/index.js';
import { FilesService, type UploadedContent } from './files.service.js';
import type { FileOwnerAccess, FileOwnerResolver } from './public/files.facade.js';
import type { FileRecord, FilesRepository, NewFile } from './repositories/files.repository.js';
import type { FileStorage } from './storage/file-storage.js';

const OWNER = '0190f6c4-0000-7000-8000-000000000001';
const access = {} as UserPermissions;

function memoryRepository(): FilesRepository & { rows: FileRecord[] } {
  const rows: FileRecord[] = [];
  return {
    rows,
    listByOwner: async (type, id) => rows.filter((row) => row.ownerType === type && row.ownerId === id && row.active),
    countByOwners: async (type, ids) =>
      Object.fromEntries(ids.map((id) => [id, rows.filter((row) => row.ownerType === type && row.ownerId === id && row.active).length])),
    findById: async (id) => rows.find((row) => row.id === id) ?? null,
    create: async (files: NewFile[]) => {
      const created = files.map((file) => ({ ...file, active: true, createdAt: new Date() }));
      rows.push(...created);
      return created;
    },
    updateDescription: async (id, description) => {
      const row = rows.find((current) => current.id === id)!;
      row.description = description;
      return row;
    },
    deactivate: async (id) => {
      rows.find((row) => row.id === id)!.active = false;
    },
    usedBytes: async () => rows.filter((row) => row.active).reduce((sum, row) => sum + row.sizeBytes, 0),
  };
}

function memoryStorage(): FileStorage & { objects: Map<string, Buffer>; failOn?: string } {
  const objects = new Map<string, Buffer>();
  const storage: FileStorage & { objects: Map<string, Buffer>; failOn?: string } = {
    objects,
    put: async (key, content) => {
      if (storage.failOn && key.includes(storage.failOn)) throw new Error('falhou');
      objects.set(key, content);
    },
    get: async (key) => objects.get(key) ?? null,
    remove: async (keys) => keys.forEach((key) => objects.delete(key)),
    downloadUrl: async (key, options) => `https://storage/${key}?name=${options.fileName}&inline=${options.inline}`,
  };
  return storage;
}

function setup(ownerAccess: FileOwnerAccess | null, env: Record<string, string> = {}) {
  const repository = memoryRepository();
  const storage = memoryStorage();
  const auth = { getUsers: async () => [{ id: 'u1', name: 'Ana', email: 'a@a', color: null, avatarFileId: null, active: true }] };
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  const service = new FilesService(repository, storage, auth as unknown as AuthFacade, config);
  const resolver: FileOwnerResolver = { module: 'projects', ownerTypes: ['job'], resolve: async () => ownerAccess };
  service.registerOwner(resolver);
  return { service, repository, storage };
}

const upload = (name: string, size = 3): UploadedContent => ({
  originalname: Buffer.from(name, 'utf8').toString('latin1'),
  mimetype: 'application/pdf',
  size,
  buffer: Buffer.alloc(size, 1),
});

describe('FilesService', () => {
  it('envia, lista com o autor, descreve e exclui (liberando o storage)', async () => {
    const { service, storage, repository } = setup({ canView: true, canChange: true });
    const list = await service.upload('u1', access, 'job', OWNER, [upload('Peça.pdf'), upload('b.pdf')]);
    expect(list.items.map((item) => item.name).sort()).toEqual(['Peça.pdf', 'b.pdf']);
    expect(list.items[0]!.uploadedBy?.name).toBe('Ana');
    expect([...storage.objects.keys()].every((key) => key.startsWith(`projects/job/${OWNER}/`))).toBe(true);

    const first = repository.rows[0]!;
    expect((await service.describe('u1', access, first.id, '  versão final ')).description).toBe('versão final');
    expect(await service.countByOwners('job', [OWNER, OWNER])).toEqual({ [OWNER]: 2 });

    await service.remove('u1', access, first.id);
    expect(storage.objects.has(first.storageKey)).toBe(false);
    expect((await service.list('u1', access, 'job', OWNER)).items).toHaveLength(1);
    await expect(service.downloadUrl('u1', access, first.id, false)).rejects.toThrow(NotFoundException);
  });

  it('só abre no navegador os tipos seguros', async () => {
    const { service, repository } = setup({ canView: true, canChange: true });
    await service.upload('u1', access, 'job', OWNER, [upload('a.pdf'), { ...upload('b.html'), mimetype: 'text/html' }]);
    const pdf = repository.rows.find((row) => row.originalName === 'a.pdf')!;
    const html = repository.rows.find((row) => row.originalName === 'b.html')!;
    expect((await service.downloadUrl('u1', access, pdf.id, true)).url).toContain('inline=true');
    expect((await service.downloadUrl('u1', access, html.id, true)).url).toContain('inline=false');
  });

  it('respeita o acesso do dono do documento', async () => {
    const readOnly = setup({ canView: true, canChange: false });
    await expect(readOnly.service.upload('u1', access, 'job', OWNER, [upload('a.pdf')])).rejects.toThrow(ForbiddenException);
    expect((await readOnly.service.list('u1', access, 'job', OWNER)).canChange).toBe(false);

    const hidden = setup(null);
    await expect(hidden.service.list('u1', access, 'job', OWNER)).rejects.toThrow(NotFoundException);
    await expect(hidden.service.list('u1', access, 'media', OWNER)).rejects.toThrow(BadRequestException);
  });

  it('barra tamanho e cota, e não deixa lixo no storage quando falha', async () => {
    const { service, storage, repository } = setup({ canView: true, canChange: true }, { FILES_MAX_MB: '1', FILES_QUOTA_GB: '1' });
    await expect(service.upload('u1', access, 'job', OWNER, [upload('a.pdf', 2 * 1024 * 1024)])).rejects.toThrow('no máximo 1 MB');

    storage.failOn = 'segundo';
    await expect(service.upload('u1', access, 'job', OWNER, [upload('primeiro.pdf'), upload('segundo.pdf')])).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.objects.size).toBe(0);
    expect(repository.rows).toHaveLength(0);
  });

  it('não aceita dois resolvedores para o mesmo tipo', () => {
    const { service } = setup(null);
    expect(() => service.registerOwner({ module: 'x', ownerTypes: ['job'], resolve: async () => null })).toThrow('já registrado');
  });
});
