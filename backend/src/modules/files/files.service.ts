import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AUTH_FACADE, type AuthFacade, type UserPermissions } from '../auth/public/index.js';
import { checkUpload, FileRuleError, fixUploadName, isInlineType, storageKey } from './domain/file-rules.js';
import type {
  FileOwnerAccess,
  FileOwnerResolver,
  FilesFacade,
  FileSummary,
} from './public/files.facade.js';
import { FILES_REPOSITORY, type FileRecord, type FilesRepository, type NewFile } from './repositories/files.repository.js';
import { FILE_STORAGE, type FileStorage, type SignedContent } from './storage/file-storage.js';

/** Arquivo recebido no upload (o que o multer entrega). */
export interface UploadedContent {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileView {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string; color: string | null } | null;
  canChange: boolean;
}

export interface FileList {
  items: FileView[];
  canChange: boolean;
}

const LINK_SECONDS = 5 * 60;
const MB = 1024 * 1024;

@Injectable()
export class FilesService implements FilesFacade {
  private readonly logger = new Logger(FilesService.name);
  private readonly resolvers = new Map<string, FileOwnerResolver>();
  readonly maxFileBytes: number;
  private readonly quotaBytes: number | null;

  constructor(
    @Inject(FILES_REPOSITORY) private readonly files: FilesRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
    config: ConfigService,
  ) {
    this.maxFileBytes = Number(config.get('FILES_MAX_MB') || 100) * MB;
    const quota = Number(config.get('FILES_QUOTA_GB') || 0);
    this.quotaBytes = quota > 0 ? quota * 1024 * MB : null;
  }

  registerOwner(resolver: FileOwnerResolver): void {
    for (const type of resolver.ownerTypes) {
      if (this.resolvers.has(type)) throw new Error(`Dono de anexos já registrado: ${type}.`);
      this.resolvers.set(type, resolver);
    }
  }

  async list(userId: string, access: UserPermissions, ownerType: string, ownerId: string): Promise<FileList> {
    const owner = await this.requireOwner(userId, access, ownerType, ownerId);
    const files = await this.files.listByOwner(ownerType, ownerId);
    return { items: await this.toViews(files, owner.access), canChange: owner.access.canChange };
  }

  async upload(
    userId: string,
    access: UserPermissions,
    ownerType: string,
    ownerId: string,
    uploads: UploadedContent[],
  ): Promise<FileList> {
    const owner = await this.requireOwner(userId, access, ownerType, ownerId);
    if (!owner.access.canChange) throw new ForbiddenException('Sem permissão para enviar anexos neste documento.');
    try {
      checkUpload({
        sizes: uploads.map((upload) => upload.size),
        maxFileBytes: this.maxFileBytes,
        usedBytes: this.quotaBytes === null ? 0 : await this.files.usedBytes(),
        quotaBytes: this.quotaBytes,
      });
    } catch (error) {
      if (error instanceof FileRuleError) throw new BadRequestException(error.message);
      throw error;
    }

    const records: NewFile[] = uploads.map((upload) => {
      const id = randomUUID();
      const name = fixUploadName(upload.originalname).slice(0, 250);
      return {
        id,
        storageKey: storageKey({ module: owner.resolver.module, type: ownerType, id: ownerId }, id, name),
        originalName: name,
        mimeType: upload.mimetype || 'application/octet-stream',
        sizeBytes: upload.size,
        ownerModule: owner.resolver.module,
        ownerType,
        ownerId,
        description: null,
        uploadedById: userId,
      };
    });
    const stored: string[] = [];
    try {
      for (const [index, record] of records.entries()) {
        await this.storage.put(record.storageKey, uploads[index]!.buffer, record.mimeType);
        stored.push(record.storageKey);
      }
      await this.files.create(records);
    } catch (error) {
      // Sem metadados, os bytes enviados viram lixo no storage: apaga.
      await this.storage.remove(stored).catch((cleanup: unknown) => this.logger.error(cleanup));
      this.logger.error(error);
      throw new BadRequestException('Não foi possível guardar os arquivos. Tente de novo.');
    }
    return this.list(userId, access, ownerType, ownerId);
  }

  async describe(userId: string, access: UserPermissions, id: string, description: string | null): Promise<FileView> {
    const { file, owner } = await this.requireChangeable(userId, access, id);
    const updated = await this.files.updateDescription(file.id, description?.trim() || null);
    const [view] = await this.toViews([updated], owner);
    return view!;
  }

  async remove(userId: string, access: UserPermissions, id: string): Promise<void> {
    const { file } = await this.requireChangeable(userId, access, id);
    await this.files.deactivate(file.id);
    // Libera o espaço; o registro fica (inativo) para auditoria.
    await this.storage.remove([file.storageKey]).catch((error: unknown) => this.logger.error(error));
  }

  async downloadUrl(
    userId: string,
    access: UserPermissions,
    id: string,
    inline: boolean,
  ): Promise<{ url: string; expiresAt: Date }> {
    const file = await this.requireActive(id);
    await this.requireOwner(userId, access, file.ownerType, file.ownerId);
    const url = await this.storage.downloadUrl(file.storageKey, {
      fileName: file.originalName,
      mimeType: file.mimeType,
      expiresInSeconds: LINK_SECONDS,
      inline: inline && isInlineType(file.mimeType),
    });
    return { url, expiresAt: new Date(Date.now() + LINK_SECONDS * 1000) };
  }

  /** Download pelo link assinado do storage local (rota pública). */
  async readSigned(token: string): Promise<SignedContent> {
    const content = this.storage.readSigned ? await this.storage.readSigned(token) : null;
    if (!content) throw new NotFoundException('Link vencido ou inválido.');
    return content;
  }

  async usage(): Promise<{ usedBytes: number; quotaBytes: number | null; maxFileBytes: number }> {
    return { usedBytes: await this.files.usedBytes(), quotaBytes: this.quotaBytes, maxFileBytes: this.maxFileBytes };
  }

  // Fachada (leitura por outros módulos)

  countByOwners(ownerType: string, ownerIds: string[]): Promise<Record<string, number>> {
    return this.files.countByOwners(ownerType, [...new Set(ownerIds)]);
  }

  async getFile(id: string): Promise<FileSummary | null> {
    const file = await this.files.findById(id);
    if (!file || !file.active) return null;
    const { storageKey: _key, description: _description, uploadedById: _by, active: _active, createdAt: _at, ...summary } = file;
    return summary;
  }

  async readContent(id: string): Promise<Buffer | null> {
    const file = await this.files.findById(id);
    return file?.active ? this.storage.get(file.storageKey) : null;
  }

  private async requireOwner(
    userId: string,
    access: UserPermissions,
    ownerType: string,
    ownerId: string,
  ): Promise<{ resolver: FileOwnerResolver; access: FileOwnerAccess }> {
    const resolver = this.resolvers.get(ownerType);
    if (!resolver) throw new BadRequestException('Este tipo de documento não aceita anexos.');
    const ownerAccess = await resolver.resolve(ownerType, ownerId, userId, access);
    if (!ownerAccess?.canView) throw new NotFoundException('Documento não encontrado.');
    return { resolver, access: ownerAccess };
  }

  private async requireActive(id: string): Promise<FileRecord> {
    const file = await this.files.findById(id);
    if (!file || !file.active) throw new NotFoundException('Anexo não encontrado.');
    return file;
  }

  private async requireChangeable(
    userId: string,
    access: UserPermissions,
    id: string,
  ): Promise<{ file: FileRecord; owner: FileOwnerAccess }> {
    const file = await this.requireActive(id);
    const owner = await this.requireOwner(userId, access, file.ownerType, file.ownerId);
    if (!owner.access.canChange) throw new ForbiddenException('Sem permissão para alterar os anexos deste documento.');
    return { file, owner: owner.access };
  }

  private async toViews(files: FileRecord[], owner: FileOwnerAccess): Promise<FileView[]> {
    const users = await this.auth.getUsers([...new Set(files.map((file) => file.uploadedById))]);
    const byId = new Map(users.map((user) => [user.id, user]));
    return files.map((file) => {
      const user = byId.get(file.uploadedById);
      return {
        id: file.id,
        name: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        description: file.description,
        createdAt: file.createdAt,
        uploadedBy: user ? { id: user.id, name: user.name, color: user.color } : null,
        canChange: owner.canChange,
      };
    });
  }
}
