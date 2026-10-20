import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { fromCents, toCents } from '../../shared/money/money.js';
import { endOfLocalDay, zonedToUtc } from '../../shared/time/timezone.js';
import type { UserPermissions } from '../auth/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../settings/public/index.js';
import { MediasService } from './medias/medias.service.js';
import type { MediaFacade, MediaSearchQuery, MediaSearchResult, MediaSummary } from './public/media.facade.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './repositories/media.repository.js';

const SHOWN = 20;
const SUMMED = 200;

function localDay(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException(`Data inválida: ${value}.`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

@Injectable()
export class MediaFacadeService implements MediaFacade {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly medias: MediaRepository,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
    private readonly mediaService: MediasService,
  ) {}

  async searchMediasForUser(
    userId: string,
    access: UserPermissions,
    query: MediaSearchQuery,
  ): Promise<MediaSearchResult> {
    // Mesma exigência da rota /medias (@RequireAccess('medias')).
    if (access.modules.medias === 0) throw new ForbiddenException('Sem acesso a mídias.');
    const { timezone } = await this.settings.getAgency();
    if (query.createdTo) localDay(query.createdTo); // endOfLocalDay lança Error comum
    const page = await this.mediaService.list(userId, access, {
      search: query.search,
      clientId: query.clientId,
      projectId: query.projectId,
      situations: query.situations,
      createdFrom: query.createdFrom ? zonedToUtc(localDay(query.createdFrom), timezone) : undefined,
      createdTo: query.createdTo ? endOfLocalDay(query.createdTo, timezone) : undefined,
      limit: SUMMED,
      offset: 0,
    });
    const summed = page.items.filter((media) => media.situation !== 'CANCELED');
    return {
      total: page.total,
      items: page.items.slice(0, SHOWN).map((media) => ({
        id: media.id,
        number: media.number,
        title: media.title,
        mediaType: media.mediaType,
        client: media.client?.name ?? null,
        vehicle: media.vehicle?.name ?? null,
        project: media.project ? { number: media.project.number, title: media.project.title } : null,
        responsible: media.responsible?.name ?? null,
        situation: media.situation,
        deadline: media.deadline,
        grossTotal: media.grossTotal,
        netValue: media.netValue,
        sentToFinance: media.sentToFinanceAt !== null,
        createdAt: media.createdAt,
      })),
      totals: {
        grossTotal: fromCents(summed.reduce((sum, media) => sum + toCents(media.grossTotal), 0)),
        netValue: fromCents(summed.reduce((sum, media) => sum + toCents(media.netValue), 0)),
        counted: summed.length,
      },
      partial: page.total > SUMMED,
    };
  }

  getSummaryByProject(projectId: string): Promise<MediaSummary> {
    return this.medias.summarize({ projectId });
  }

  getSummaryByClient(clientId: string): Promise<MediaSummary> {
    return this.medias.summarize({ clientId });
  }
}
