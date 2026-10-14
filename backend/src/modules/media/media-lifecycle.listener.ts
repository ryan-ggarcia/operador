import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  PROJECTS_FACADE,
  type DocumentLifecycleListener,
  type ProjectClosing,
  type ProjectsFacade,
} from '../projects/public/index.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './repositories/media.repository.js';

/** Arquivar o projeto conclui as mídias dele; cancelar cancela. */
@Injectable()
export class MediaLifecycleListener implements DocumentLifecycleListener, OnModuleInit {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly medias: MediaRepository,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
  ) {}

  onModuleInit(): void {
    this.projects.registerLifecycleListener(this);
  }

  async afterProjectClosed(projectId: string, actorId: string, outcome: ProjectClosing): Promise<void> {
    await this.medias.closeByProject(projectId, outcome === 'archived' ? 'DONE' : 'CANCELED', actorId);
  }
}
