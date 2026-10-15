import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATIONS_FACADE, type NotificationsFacade } from '../notifications/public/index.js';
import { documentNumber } from './domain/job-rules.js';

export interface NotifiedDocument {
  label: string;
  link: string;
}

export function jobTarget(job: {
  id: string;
  projectNumber: number;
  sequence: number;
  title: string;
}): NotifiedDocument {
  return {
    label: `${documentNumber(job.projectNumber, job.sequence)} ${job.title}`,
    link: `/jobs/${job.id}`,
  };
}

export function projectTarget(project: { id: string; number: number; title: string }): NotifiedDocument {
  return {
    label: `${project.number} ${project.title}`,
    link: `/projetos/${project.id}`,
  };
}

/** Avisos de projetos, jobs e comentários (os textos ficam juntos aqui). */
@Injectable()
export class ProjectsNotifier {
  constructor(
    @Inject(NOTIFICATIONS_FACADE)
    private readonly notifications: NotificationsFacade,
  ) {}

  involved(target: NotifiedDocument, userIds: (string | null)[], actorId: string): Promise<void> {
    return this.notifications.notify({
      event: 'document.involved',
      userIds: userIds.filter((id): id is string => Boolean(id)),
      actorId,
      action: 'envolveu você em',
      target,
    });
  }

  completed(target: NotifiedDocument, responsibleId: string | null, actorId: string, verb = 'concluiu'): Promise<void> {
    return this.notifications.notify({
      event: 'document.completed',
      userIds: responsibleId ? [responsibleId] : [],
      actorId,
      action: verb,
      target,
    });
  }

  reopened(target: NotifiedDocument, involvedIds: (string | null)[], actorId: string): Promise<void> {
    return this.notifications.notify({
      event: 'document.reopened',
      userIds: involvedIds.filter((id): id is string => Boolean(id)),
      actorId,
      action: 'reabriu',
      target,
    });
  }

  async commented(
    target: NotifiedDocument,
    people: { mentionedIds: string[]; responsibleId: string | null },
    actorId: string,
  ): Promise<void> {
    await this.notifications.notify({
      event: 'comment.mentioned',
      userIds: people.mentionedIds,
      actorId,
      action: 'mencionou você em',
      target,
    });
    // O responsável mencionado já recebeu o aviso acima.
    if (people.responsibleId && !people.mentionedIds.includes(people.responsibleId)) {
      await this.notifications.notify({
        event: 'comment.on-responsible',
        userIds: [people.responsibleId],
        actorId,
        action: 'comentou em',
        target,
      });
    }
  }
}
