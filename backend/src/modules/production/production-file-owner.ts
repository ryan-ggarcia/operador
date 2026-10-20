import { Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { UserPermissions } from '../auth/public/index.js';
import {
  FILES_FACADE,
  type FileOwnerAccess,
  type FileOwnerRegistry,
  type FileOwnerResolver,
} from '../files/public/index.js';
import { canActOnProduction } from './domain/production-access.js';
import { ProductionsService } from './productions/productions.service.js';

/** Anexos da produção: vê quem vê; envia e exclui quem pode agir nela, aberta. */
@Injectable()
export class ProductionFileOwner implements FileOwnerResolver, OnModuleInit {
  readonly module = 'production';
  readonly ownerTypes = ['production'] as const;

  constructor(
    private readonly productions: ProductionsService,
    @Inject(FILES_FACADE) private readonly files: FileOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.files.registerOwner(this);
  }

  async resolve(_ownerType: string, ownerId: string, userId: string, access: UserPermissions): Promise<FileOwnerAccess | null> {
    try {
      const production = await this.productions.requireViewable(userId, access, ownerId);
      return {
        canView: true,
        canChange: production.situation === 'OPEN' && canActOnProduction(userId, access, production),
      };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}
