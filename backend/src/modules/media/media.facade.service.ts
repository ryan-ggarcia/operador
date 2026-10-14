import { Inject, Injectable } from '@nestjs/common';
import type { MediaFacade, MediaSummary } from './public/media.facade.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './repositories/media.repository.js';

@Injectable()
export class MediaFacadeService implements MediaFacade {
  constructor(@Inject(MEDIA_REPOSITORY) private readonly medias: MediaRepository) {}

  getSummaryByProject(projectId: string): Promise<MediaSummary> {
    return this.medias.summarize({ projectId });
  }

  getSummaryByClient(clientId: string): Promise<MediaSummary> {
    return this.medias.summarize({ clientId });
  }
}
