import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { FilesModule } from '../files/public/index.js';
import { SETTINGS_FACADE } from './public/settings.facade.js';
import { AGENCY_REPOSITORY } from './repositories/agency.repository.js';
import { PrismaAgencyRepository } from './repositories/prisma-agency.repository.js';
import { SettingsController } from './settings.controller.js';
import { SettingsFileOwner } from './settings-file-owner.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [AuthModule, FilesModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    SettingsFileOwner,
    { provide: AGENCY_REPOSITORY, useClass: PrismaAgencyRepository },
    { provide: SETTINGS_FACADE, useExisting: SettingsService },
  ],
  exports: [SETTINGS_FACADE],
})
export class SettingsModule {}
