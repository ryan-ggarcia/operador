import { Injectable } from '@nestjs/common';
import type {
  ClosingDocuments,
  DocumentLifecycleListener,
} from './public/lifecycle.js';

/** Registro dos ouvintes do ciclo de vida (ver public/lifecycle.ts). */
@Injectable()
export class DocumentLifecycleService {
  private readonly listeners: DocumentLifecycleListener[] = [];

  register(listener: DocumentLifecycleListener): void {
    this.listeners.push(listener);
  }

  async beforeClose(documents: ClosingDocuments): Promise<void> {
    for (const listener of this.listeners) await listener.beforeClose?.(documents);
  }

  async afterProjectClosed(projectId: string, actorId: string): Promise<void> {
    for (const listener of this.listeners) {
      await listener.afterProjectClosed?.(projectId, actorId);
    }
  }
}
