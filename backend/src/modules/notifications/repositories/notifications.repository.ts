import type { StoredPreference } from '../domain/recipients.js';

export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

export interface NotificationRecord {
  id: string;
  userId: string;
  event: string;
  title: string;
  link: string | null;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}

export type NewNotification = Pick<NotificationRecord, 'userId' | 'event' | 'title' | 'link' | 'payload'>;

export interface NotificationsRepository {
  list(userId: string, filter: { unreadOnly: boolean; limit: number }): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  create(rows: NewNotification[]): Promise<void>;
  /** Sem ids, marca todas as do usuário. */
  markRead(userId: string, ids: string[] | null, at: Date): Promise<void>;
  preferencesOf(userIds: string[]): Promise<StoredPreference[]>;
  savePreferences(userId: string, preferences: { event: string; inApp: boolean }[]): Promise<void>;
}
