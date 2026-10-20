import { Body, Controller, Get, HttpCode, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import { LoadAccess } from '../auth/public/index.js';
import type { AuthUser } from '../../shared/auth/auth-user.js';
import { MarkReadDto, NotificationListDto, PreferencesDto } from './dto/notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

/** Avisos do próprio usuário: qualquer usuário logado vê só os seus. */
@Controller('notifications')
@LoadAccess()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: NotificationListDto) {
    return this.notifications.list(user.id, query.unread ?? false, query.limit ?? 30);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { unread: await this.notifications.unreadCount(user.id) };
  }

  @Post('read')
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthUser, @Body() body: MarkReadDto) {
    return this.notifications.markRead(user.id, body.ids ?? null);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.id);
  }

  @Put('preferences')
  savePreferences(@CurrentUser() user: AuthUser, @Body() body: PreferencesDto) {
    return this.notifications.savePreferences(user.id, body.preferences);
  }
}
