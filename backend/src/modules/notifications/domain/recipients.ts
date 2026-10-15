import type { NotificationEvent } from '../public/notifications.facade.js';

/** Preferência guardada; sem linha, o aviso no sistema vale (ligado por padrão). */
export interface StoredPreference {
  userId: string;
  event: string;
  inApp: boolean;
}

/**
 * Quem recebe: sem repetir, sem vazios, sem quem fez a ação e sem quem
 * desligou o evento.
 */
export function recipients(
  userIds: (string | null | undefined)[],
  actorId: string,
  event: NotificationEvent,
  preferences: StoredPreference[],
): string[] {
  const muted = new Set(
    preferences
      .filter((preference) => preference.event === event && !preference.inApp)
      .map((preference) => preference.userId),
  );
  return [...new Set(userIds.filter((id): id is string => Boolean(id)))].filter(
    (id) => id !== actorId && !muted.has(id),
  );
}

/** Link interno: só caminhos do próprio front (evita redirecionar para fora). */
export function safeLink(link: string): string | null {
  return /^\/[a-z0-9/_-]*(\?[\w=&%-]*)?$/i.test(link) && !link.startsWith('//') ? link : null;
}
