import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { AUTH_FACADE, type AuthFacade } from '../auth/public/index.js';
import { recipients, safeLink } from './domain/recipients.js';
import {
  NOTIFICATION_EVENTS,
  type NotificationEvent,
  type NotificationsFacade,
  type NotifyInput,
} from './public/notifications.facade.js';
import {
  NOTIFICATIONS_REPOSITORY,
  type NotificationRecord,
  type NotificationsRepository,
} from './repositories/notifications.repository.js';

export interface NotificationView {
  id: string;
  event: string;
  title: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
  actor: { id: string; name: string; color: string | null } | null;
}

export interface PreferenceView {
  event: NotificationEvent;
  group: string;
  label: string;
  inApp: boolean;
}

interface Payload {
  actorId?: string;
}

@Injectable()
export class NotificationsService implements NotificationsFacade {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly notifications: NotificationsRepository,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    try {
      const preferences = await this.notifications.preferencesOf(input.userIds);
      const userIds = recipients(input.userIds, input.actorId, input.event, preferences);
      if (userIds.length === 0) return;
      const [actor] = await this.auth.getUsers([input.actorId]);
      const title = `${actor?.name ?? 'Alguém'} ${input.action} ${input.target.label}`.slice(0, 500);
      const link = safeLink(input.target.link);
      await this.notifications.create(
        userIds.map((userId) => ({
          userId,
          event: input.event,
          title,
          link,
          payload: { actorId: input.actorId },
        })),
      );
    } catch (error) {
      this.logger.error(error);
    }
  }

  async list(
    userId: string,
    unreadOnly: boolean,
    limit: number,
  ): Promise<{ items: NotificationView[]; unread: number }> {
    const [rows, unread] = await Promise.all([
      this.notifications.list(userId, { unreadOnly, limit }),
      this.notifications.countUnread(userId),
    ]);
    return { items: await this.toViews(rows), unread };
  }

  unreadCount(userId: string): Promise<number> {
    return this.notifications.countUnread(userId);
  }

  async markRead(userId: string, ids: string[] | null): Promise<void> {
    await this.notifications.markRead(userId, ids, new Date());
  }

  async preferences(userId: string): Promise<PreferenceView[]> {
    const stored = await this.notifications.preferencesOf([userId]);
    return (Object.keys(NOTIFICATION_EVENTS) as NotificationEvent[]).map((event) => ({
      event,
      ...NOTIFICATION_EVENTS[event],
      inApp: stored.find((preference) => preference.event === event)?.inApp ?? true,
    }));
  }

  async savePreferences(userId: string, preferences: { event: string; inApp: boolean }[]): Promise<PreferenceView[]> {
    const unknown = preferences.find((preference) => !(preference.event in NOTIFICATION_EVENTS));
    if (unknown) throw new BadRequestException(`Evento desconhecido: ${unknown.event}.`);
    await this.notifications.savePreferences(userId, preferences);
    return this.preferences(userId);
  }

  private async toViews(rows: NotificationRecord[]): Promise<NotificationView[]> {
    const actorIds = [
      ...new Set(rows.map((row) => (row.payload as Payload | null)?.actorId).filter((id): id is string => !!id)),
    ];
    const users = new Map((await this.auth.getUsers(actorIds)).map((user) => [user.id, user]));
    return rows.map((row) => {
      const actor = users.get((row.payload as Payload | null)?.actorId ?? '');
      return {
        id: row.id,
        event: row.event,
        title: row.title,
        link: row.link,
        read: row.readAt !== null,
        createdAt: row.createdAt,
        actor: actor ? { id: actor.id, name: actor.name, color: actor.color } : null,
      };
    });
  }
}
