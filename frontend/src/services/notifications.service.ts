import type { HttpClient } from './http';
import type { UserRef } from './types';

export interface AppNotification {
  id: string;
  event: string;
  title: string;
  link: string | null;
  read: boolean;
  createdAt: string;
  actor: UserRef | null;
}

export interface NotificationPreference {
  event: string;
  group: string;
  label: string;
  inApp: boolean;
}

export class NotificationsService {
  constructor(private readonly http: HttpClient) {}

  list(query: { unread?: boolean; limit?: number } = {}) {
    return this.http.get<{ items: AppNotification[]; unread: number }>('/notifications', { ...query });
  }
  unreadCount() {
    return this.http.get<{ unread: number }>('/notifications/unread-count');
  }
  /** Sem ids, marca todas como lidas. */
  markRead(ids?: string[]) {
    return this.http.post<void>('/notifications/read', ids ? { ids } : {});
  }
  preferences() {
    return this.http.get<NotificationPreference[]>('/notifications/preferences');
  }
  savePreferences(preferences: { event: string; inApp: boolean }[]) {
    return this.http.put<NotificationPreference[]>('/notifications/preferences', { preferences });
  }
}
