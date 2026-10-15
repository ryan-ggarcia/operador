import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATIONS_FACADE } from './public/notifications.facade.js';
import { NOTIFICATIONS_REPOSITORY } from './repositories/notifications.repository.js';
import { PrismaNotificationsRepository } from './repositories/prisma-notifications.repository.js';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    {
      provide: NOTIFICATIONS_REPOSITORY,
      useClass: PrismaNotificationsRepository,
    },
    { provide: NOTIFICATIONS_FACADE, useExisting: NotificationsService },
  ],
  exports: [NOTIFICATIONS_FACADE],
})
export class NotificationsModule {}
