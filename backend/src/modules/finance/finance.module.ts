import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { CrmModule } from '../crm/public/index.js';
import { ProjectsModule } from '../projects/public/index.js';
import { SettingsModule } from '../settings/public/index.js';
import { BillsService } from './bills/bills.service.js';
import { TreasuryService } from './bills/treasury.service.js';
import { FinanceController, FinanceSettingsController } from './finance.controller.js';
import { FinanceFacadeService } from './finance.facade.service.js';
import { FinanceLifecycleListener } from './finance-lifecycle.listener.js';
import { FINANCE_FACADE } from './public/finance.facade.js';
import { BILL_REPOSITORY, FINANCE_CATALOG_REPOSITORY } from './repositories/finance.repository.js';
import { PrismaBillRepository } from './repositories/prisma-bill.repository.js';
import { PrismaFinanceCatalogRepository } from './repositories/prisma-finance-catalog.repository.js';

@Module({
  imports: [AuthModule, CrmModule, ProjectsModule, SettingsModule],
  controllers: [FinanceController, FinanceSettingsController],
  providers: [
    BillsService,
    TreasuryService,
    FinanceLifecycleListener,
    { provide: BILL_REPOSITORY, useClass: PrismaBillRepository },
    { provide: FINANCE_CATALOG_REPOSITORY, useClass: PrismaFinanceCatalogRepository },
    { provide: FINANCE_FACADE, useClass: FinanceFacadeService },
  ],
  exports: [FINANCE_FACADE],
})
export class FinanceModule {}
