/** Token de injeção da fachada do módulo notifications. */
export const NOTIFICATIONS_FACADE = Symbol('NOTIFICATIONS_FACADE');

/** Eventos da v1 (cada usuário liga ou desliga cada um). */
export const NOTIFICATION_EVENTS = {
  'comment.mentioned': { group: 'Comentários', label: 'Quando fui mencionado' },
  'comment.on-responsible': {
    group: 'Comentários',
    label: 'Quando comentam em documento de que sou responsável',
  },
  'document.involved': {
    group: 'Documentos',
    label: 'Quando sou envolvido (responsável ou membro)',
  },
  'document.completed': {
    group: 'Documentos',
    label: 'Quando concluem algo de que sou responsável',
  },
  'document.reopened': {
    group: 'Documentos',
    label: 'Quando reabrem algo em que estou envolvido',
  },
} as const;

export type NotificationEvent = keyof typeof NOTIFICATION_EVENTS;

export interface NotifyInput {
  event: NotificationEvent;
  userIds: string[];
  /** Quem fez a ação: não recebe o aviso e o nome dele abre a frase. */
  actorId: string;
  /** Resto da frase depois do nome, ex.: "mencionou você em". */
  action: string;
  /** Documento citado no aviso. */
  target: { label: string; link: string };
}

/** Interface pública do módulo notifications (só ação: avisar). */
export interface NotificationsFacade {
  /**
   * Cria os avisos no sistema respeitando as preferências. Nunca lança: um
   * aviso que falha não pode desfazer a ação de quem o disparou.
   */
  notify(input: NotifyInput): Promise<void>;
}
