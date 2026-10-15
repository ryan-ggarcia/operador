import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { CrmModule } from '../crm/public/index.js';
import { FinanceModule } from '../finance/public/index.js';
import { ProjectsModule } from '../projects/public/index.js';
import { SettingsModule } from '../settings/public/index.js';
import { ProductionCatalogService } from './catalog/production-catalog.service.js';
import { ProductionFacadeService } from './production.facade.service.js';
import { ProductionLifecycleListener } from './production-lifecycle.listener.js';
import { ProductionsController, ProductionSettingsController } from './productions/productions.controller.js';
import { ProductionsService } from './productions/productions.service.js';
import { PRODUCTION_FACADE } from './public/production.facade.js';
import {
  PrismaProductionCatalogRepository,
  PrismaProductionRepository,
} from './repositories/prisma-production.repository.js';
import { PRODUCTION_CATALOG_REPOSITORY, PRODUCTION_REPOSITORY } from './repositories/production.repository.js';

@Module({
  imports: [AuthModule, CrmModule, ProjectsModule, SettingsModule, FinanceModule],
  controllers: [ProductionsController, ProductionSettingsController],
  providers: [
    ProductionsService,
    ProductionCatalogService,
    ProductionLifecycleListener,
    { provide: PRODUCTION_REPOSITORY, useClass: PrismaProductionRepository },
    { provide: PRODUCTION_CATALOG_REPOSITORY, useClass: PrismaProductionCatalogRepository },
    { provide: PRODUCTION_FACADE, useClass: ProductionFacadeService },
  ],
  exports: [PRODUCTION_FACADE],
})
export class ProductionModule {}
