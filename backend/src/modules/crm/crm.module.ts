import { Module } from '@nestjs/common';
import { CrmFacadeService } from './crm.facade.service.js';
import { CRM_FACADE } from './public/crm.facade.js';
import { PARTY_REPOSITORY } from './repositories/party.repository.js';
import { PrismaPartyRepository } from './repositories/prisma-party.repository.js';

@Module({
  providers: [
    { provide: PARTY_REPOSITORY, useClass: PrismaPartyRepository },
    { provide: CRM_FACADE, useClass: CrmFacadeService },
  ],
  exports: [CRM_FACADE],
})
export class CrmModule {}
