import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { FilesModule } from '../files/public/index.js';
import { CrmModule } from '../crm/public/index.js';
import { FinanceModule } from '../finance/public/index.js';
import { ProjectsModule } from '../projects/public/index.js';
import { SettingsModule } from '../settings/public/index.js';
import { MediaCatalogController } from './catalog/media-catalog.controller.js';
import { MediaCatalogService } from './catalog/media-catalog.service.js';
import { MediaFacadeService } from './media.facade.service.js';
import { MediaLifecycleListener } from './media-lifecycle.listener.js';
import { MediasController } from './medias/medias.controller.js';
import { MediasService } from './medias/medias.service.js';
import { MEDIA_FACADE } from './public/media.facade.js';
import { MEDIA_CATALOG_REPOSITORY, MEDIA_REPOSITORY } from './repositories/media.repository.js';
import { PrismaMediaCatalogRepository } from './repositories/prisma-media-catalog.repository.js';
import { PrismaMediaRepository } from './repositories/prisma-media.repository.js';
import { MediaFileOwner } from './media-file-owner.js';

@Module({
  imports: [AuthModule, FilesModule, CrmModule, ProjectsModule, SettingsModule, FinanceModule],
  controllers: [MediasController, MediaCatalogController],
  providers: [
    MediaFileOwner,
    MediasService,
    MediaCatalogService,
    MediaLifecycleListener,
    { provide: MEDIA_REPOSITORY, useClass: PrismaMediaRepository },
    { provide: MEDIA_CATALOG_REPOSITORY, useClass: PrismaMediaCatalogRepository },
    { provide: MEDIA_FACADE, useClass: MediaFacadeService },
  ],
  exports: [MEDIA_FACADE],
})
export class MediaModule {}
