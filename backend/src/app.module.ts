import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/public/index.js';
import { CrmModule } from './modules/crm/public/index.js';
import { MediaModule } from './modules/media/public/index.js';
import { ProjectsModule } from './modules/projects/public/index.js';
import { SettingsModule } from './modules/settings/public/index.js';
import { TimesheetModule } from './modules/timesheet/public/index.js';
import { SharedAuthModule } from './shared/auth/shared-auth.module.js';
import { HealthController } from './shared/health/health.controller.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SharedAuthModule,
    AuthModule,
    CrmModule,
    SettingsModule,
    ProjectsModule,
    TimesheetModule,
    MediaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
