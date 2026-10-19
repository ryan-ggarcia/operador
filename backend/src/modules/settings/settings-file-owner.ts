import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { UserPermissions } from '../auth/public/index.js';
import {
  FILES_FACADE,
  type FileOwnerAccess,
  type FileOwnerRegistry,
  type FileOwnerResolver,
} from '../files/public/index.js';

/** Uma agência só: os arquivos dela (o logo) ficam neste id fixo. */
export const AGENCY_FILE_OWNER_ID = '00000000-0000-0000-0000-000000000000';

/** Logo da agência: todos veem (sai nos documentos); só administradores trocam. */
@Injectable()
export class SettingsFileOwner implements FileOwnerResolver, OnModuleInit {
  readonly module = 'settings';
  readonly ownerTypes = ['agency'] as const;

  constructor(@Inject(FILES_FACADE) private readonly files: FileOwnerRegistry) {}

  onModuleInit(): void {
    this.files.registerOwner(this);
  }

  async resolve(_ownerType: string, ownerId: string, _userId: string, access: UserPermissions): Promise<FileOwnerAccess | null> {
    if (ownerId !== AGENCY_FILE_OWNER_ID) return null;
    return { canView: true, canChange: access.flags.administrator };
  }
}
