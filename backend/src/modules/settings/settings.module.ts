import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { SETTINGS_FACADE } from './public/settings.facade.js';
import { AGENCY_REPOSITORY } from './repositories/agency.repository.js';
import { PrismaAgencyRepository } from './repositories/prisma-agency.repository.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    { provide: AGENCY_REPOSITORY, useClass: PrismaAgencyRepository },
    { provide: SETTINGS_FACADE, useExisting: SettingsService },
  ],
  exports: [SETTINGS_FACADE],
})
export class SettingsModule {}
