import { Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { UserPermissions } from '../auth/public/index.js';
import {
  FILES_FACADE,
  type FileOwnerAccess,
  type FileOwnerRegistry,
  type FileOwnerResolver,
} from '../files/public/index.js';
import { canActOnMedia } from './domain/media-access.js';
import { MediasService } from './medias/medias.service.js';

/**
 * Anexos da mídia: vê quem vê a mídia; envia e exclui quem pode agir nela,
 * com a mídia aberta (mesmo já enviada ao financeiro).
 */
@Injectable()
export class MediaFileOwner implements FileOwnerResolver, OnModuleInit {
  readonly module = 'media';
  readonly ownerTypes = ['media'] as const;

  constructor(
    private readonly medias: MediasService,
    @Inject(FILES_FACADE) private readonly files: FileOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.files.registerOwner(this);
  }

  async resolve(_ownerType: string, ownerId: string, userId: string, access: UserPermissions): Promise<FileOwnerAccess | null> {
    try {
      const media = await this.medias.requireViewable(userId, access, ownerId);
      return { canView: true, canChange: media.situation === 'OPEN' && canActOnMedia(userId, access, media) };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}
