import type { AuthFacade } from '../auth/public/index.js';
import type { StoredPreference } from './domain/recipients.js';
import { NotificationsService } from './notifications.service.js';
import type { NewNotification, NotificationRecord, NotificationsRepository } from './repositories/notifications.repository.js';

function setup(preferences: StoredPreference[] = [], failCreate = false) {
  const rows: NotificationRecord[] = [];
  const repository: NotificationsRepository = {
    list: async (userId, filter) =>
      rows.filter((row) => row.userId === userId && (!filter.unreadOnly || !row.readAt)).slice(0, filter.limit),
    countUnread: async (userId) => rows.filter((row) => row.userId === userId && !row.readAt).length,
    create: async (created: NewNotification[]) => {
      if (failCreate) throw new Error('banco fora');
      rows.push(...created.map((row, index) => ({ ...row, id: `n${rows.length + index}`, readAt: null, createdAt: new Date() })));
    },
    markRead: async (userId, ids, at) => {
      for (const row of rows) if (row.userId === userId && (!ids || ids.includes(row.id))) row.readAt = at;
    },
    preferencesOf: async (userIds) => preferences.filter((preference) => userIds.includes(preference.userId)),
    savePreferences: async () => {},
  };
  const auth = {
    getUsers: async (ids: string[]) =>
      ids.map((id) => ({ id, name: id === 'ana' ? 'Ana' : id, email: '', color: null, avatarFileId: null, active: true })),
  } as unknown as AuthFacade;
  return { service: new NotificationsService(repository, auth), rows };
}

const input = {
  event: 'comment.mentioned' as const,
  actorId: 'ana',
  action: 'mencionou você em',
  target: { label: '1.2 Peças', link: '/jobs/abc' },
};

describe('NotificationsService', () => {
  it('avisa os destinatários, menos o autor e quem desligou o evento', async () => {
    const { service, rows } = setup([{ userId: 'caio', event: 'comment.mentioned', inApp: false }]);
    await service.notify({ ...input, userIds: ['bia', 'ana', 'caio', 'bia'] });
    expect(rows.map((row) => [row.userId, row.title, row.link])).toEqual([['bia', 'Ana mencionou você em 1.2 Peças', '/jobs/abc']]);

    const list = await service.list('bia', false, 10);
    expect(list.unread).toBe(1);
    expect(list.items[0]!.actor?.name).toBe('Ana');
    await service.markRead('bia', null);
    expect(await service.unreadCount('bia')).toBe(0);
  });

  it('descarta link externo e nunca lança', async () => {
    const { service, rows } = setup();
    await service.notify({ ...input, userIds: ['bia'], target: { label: 'x', link: 'https://fora.com' } });
    expect(rows[0]!.link).toBeNull();

    const failing = setup([], true);
    await expect(failing.service.notify({ ...input, userIds: ['bia'] })).resolves.toBeUndefined();
  });

  it('lista as preferências com o padrão ligado e recusa evento desconhecido', async () => {
    const { service } = setup([{ userId: 'bia', event: 'document.involved', inApp: false }]);
    const preferences = await service.preferences('bia');
    expect(preferences.find((preference) => preference.event === 'document.involved')?.inApp).toBe(false);
    expect(preferences.find((preference) => preference.event === 'comment.mentioned')?.inApp).toBe(true);
    await expect(service.savePreferences('bia', [{ event: 'x', inApp: true }])).rejects.toThrow('desconhecido');
  });
});
