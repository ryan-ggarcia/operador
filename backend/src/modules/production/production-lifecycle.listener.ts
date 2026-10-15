import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  PROJECTS_FACADE,
  type DocumentLifecycleListener,
  type ProjectClosing,
  type ProjectsFacade,
} from '../projects/public/index.js';
import { PRODUCTION_REPOSITORY, type ProductionRepository } from './repositories/production.repository.js';

/** Arquivar o projeto conclui as produções dele; cancelar cancela. */
@Injectable()
export class ProductionLifecycleListener implements DocumentLifecycleListener, OnModuleInit {
  constructor(
    @Inject(PRODUCTION_REPOSITORY) private readonly productions: ProductionRepository,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
  ) {}

  onModuleInit(): void {
    this.projects.registerLifecycleListener(this);
  }

  async afterProjectClosed(projectId: string, actorId: string, outcome: ProjectClosing): Promise<void> {
    await this.productions.closeByProject(projectId, outcome === 'archived' ? 'DONE' : 'CANCELED', actorId);
  }
}
