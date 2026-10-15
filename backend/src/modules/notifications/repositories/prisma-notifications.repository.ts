import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { StoredPreference } from '../domain/recipients.js';
import type { NewNotification, NotificationRecord, NotificationsRepository } from './notifications.repository.js';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, filter: { unreadOnly: boolean; limit: number }): Promise<NotificationRecord[]> {
    return this.prisma.notification.findMany({
      where: { userId, ...(filter.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: filter.limit,
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async create(rows: NewNotification[]): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.notification.createMany({
      data: rows.map((row) => ({
        ...row,
        payload: (row.payload ?? Prisma.DbNull) as Prisma.InputJsonValue,
      })),
    });
  }

  async markRead(userId: string, ids: string[] | null, at: Date): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: at },
    });
  }

  preferencesOf(userIds: string[]): Promise<StoredPreference[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, event: true, inApp: true },
    });
  }

  async savePreferences(userId: string, preferences: { event: string; inApp: boolean }[]): Promise<void> {
    await this.prisma.$transaction(
      preferences.map(({ event, inApp }) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_event: { userId, event } },
          create: { userId, event, inApp },
          update: { inApp },
        }),
      ),
    );
  }
}
