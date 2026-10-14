import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AUTH_FACADE, type AuthFacade } from '../auth/public/index.js';
import {
  PROJECTS_FACADE,
  type ClosingDocuments,
  type DocumentLifecycleListener,
  type ProjectsFacade,
} from '../projects/public/index.js';
import { elapsedMinutes } from './domain/time-rules.js';
import {
  TIME_ENTRY_REPOSITORY,
  type TimeEntryRepository,
} from './repositories/time-entry.repository.js';

/**
 * Liga o timesheet ao ciclo de vida dos documentos de projects:
 * - job ou tarefa não se conclui nem se cancela com cronômetro ativo;
 * - arquivar ou cancelar o projeto para os cronômetros dele.
 */
@Injectable()
export class TimesheetLifecycleListener implements DocumentLifecycleListener, OnModuleInit {
  constructor(
    @Inject(TIME_ENTRY_REPOSITORY) private readonly entries: TimeEntryRepository,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
  ) {}

  onModuleInit(): void {
    this.projects.registerLifecycleListener(this);
  }

  async beforeClose(documents: ClosingDocuments): Promise<void> {
    const running = await this.entries.findRunning({
      docs: [
        { docType: 'JOB', docIds: documents.jobIds },
        { docType: 'TASK', docIds: documents.taskIds },
      ],
    });
    if (running.length === 0) return;
    const users = await this.auth.getUsers([...new Set(running.map((entry) => entry.userId))]);
    throw new BadRequestException(
      `Há cronômetro ativo de ${users.map((user) => user.name).join(', ')}. Pare o cronômetro antes de concluir ou cancelar.`,
    );
  }

  async afterProjectClosed(projectId: string, actorId: string): Promise<void> {
    const now = new Date();
    for (const entry of await this.entries.findRunning({ projectId })) {
      await this.entries.update(
        entry.id,
        { endedAt: now, minutes: elapsedMinutes(entry.startedAt, now), situation: 'DONE' },
        actorId,
      );
    }
  }
}
