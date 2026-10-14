import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { CatalogService } from './catalog/catalog.service.js';
import { CrmFacadeService } from './crm.facade.service.js';
import {
  ClientGroupsController,
  ContactsController,
  DepartmentsController,
  PartiesController,
  PartyNotesController,
} from './parties/parties.controller.js';
import { PartiesService } from './parties/parties.service.js';
import { CRM_FACADE } from './public/crm.facade.js';
import {
  CATALOG_REPOSITORY,
  CONTACT_REPOSITORY,
  PARTY_NOTE_REPOSITORY,
} from './repositories/contact.repository.js';
import { PARTY_REPOSITORY } from './repositories/party.repository.js';
import {
  PrismaCatalogRepository,
  PrismaContactRepository,
  PrismaPartyNoteRepository,
} from './repositories/prisma-contact.repository.js';
import { PrismaPartyRepository } from './repositories/prisma-party.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PartiesController,
    ContactsController,
    PartyNotesController,
    ClientGroupsController,
    DepartmentsController,
  ],
  providers: [
    PartiesService,
    CatalogService,
    { provide: PARTY_REPOSITORY, useClass: PrismaPartyRepository },
    { provide: CONTACT_REPOSITORY, useClass: PrismaContactRepository },
    { provide: PARTY_NOTE_REPOSITORY, useClass: PrismaPartyNoteRepository },
    { provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository },
    { provide: CRM_FACADE, useClass: CrmFacadeService },
  ],
  exports: [CRM_FACADE],
})
export class CrmModule {}
