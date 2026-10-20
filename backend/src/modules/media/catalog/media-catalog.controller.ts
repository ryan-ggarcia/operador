import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { FULL, LoadAccess, RequireAccess } from '../../auth/public/index.js';
import {
  MarketDto,
  MediaStatusDto,
  NamedDto,
  NetworkDto,
  ProgramDto,
  ProgramListDto,
  StatusListDto,
} from '../dto/media.dto.js';
import { MediaCatalogService } from './media-catalog.service.js';

/** Configurações › Mídia. Listar: quem usa; alterar: nível Total em mídia. */
@Controller('media-settings')
export class MediaCatalogController {
  constructor(private readonly catalog: MediaCatalogService) {}

  @Get('networks')
  @LoadAccess()
  networks() {
    return this.catalog.listNetworks();
  }

  @Post('networks')
  @RequireAccess('medias', FULL)
  createNetwork(@Body() body: NetworkDto) {
    return this.catalog.saveNetwork(null, { ...body, active: body.active ?? true });
  }

  @Patch('networks/:id')
  @RequireAccess('medias', FULL)
  updateNetwork(@Param('id', ParseUUIDPipe) id: string, @Body() body: NetworkDto) {
    return this.catalog.saveNetwork(id, { ...body, active: body.active ?? true });
  }

  @Get('markets')
  @LoadAccess()
  markets() {
    return this.catalog.listMarkets();
  }

  @Post('markets')
  @RequireAccess('medias', FULL)
  createMarket(@Body() body: MarketDto) {
    return this.catalog.saveMarket(null, {
      name: body.name,
      abbreviation: body.abbreviation ?? null,
      state: body.state ?? null,
      active: body.active ?? true,
    });
  }

  @Patch('markets/:id')
  @RequireAccess('medias', FULL)
  updateMarket(@Param('id', ParseUUIDPipe) id: string, @Body() body: MarketDto) {
    return this.catalog.saveMarket(id, {
      name: body.name,
      abbreviation: body.abbreviation ?? null,
      state: body.state ?? null,
      active: body.active ?? true,
    });
  }

  @Get('programs')
  @LoadAccess()
  programs(@Query() query: ProgramListDto) {
    return this.catalog.listPrograms(query);
  }

  @Post('programs')
  @RequireAccess('medias', FULL)
  createProgram(@Body() body: ProgramDto) {
    return this.catalog.saveProgram(null, {
      ...body,
      channel: body.channel ?? null,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      active: body.active ?? true,
    });
  }

  @Patch('programs/:id')
  @RequireAccess('medias', FULL)
  updateProgram(@Param('id', ParseUUIDPipe) id: string, @Body() body: ProgramDto) {
    return this.catalog.saveProgram(id, {
      ...body,
      channel: body.channel ?? null,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      active: body.active ?? true,
    });
  }

  @Get('cost-metrics')
  @LoadAccess()
  costMetrics() {
    return this.catalog.listCostMetrics();
  }

  @Post('cost-metrics')
  @RequireAccess('medias', FULL)
  createCostMetric(@Body() body: NamedDto) {
    return this.catalog.saveCostMetric(null, { name: body.name, active: body.active ?? true });
  }

  @Patch('cost-metrics/:id')
  @RequireAccess('medias', FULL)
  updateCostMetric(@Param('id', ParseUUIDPipe) id: string, @Body() body: NamedDto) {
    return this.catalog.saveCostMetric(id, { name: body.name, active: body.active ?? true });
  }

  @Get('statuses')
  @LoadAccess()
  statuses(@Query() query: StatusListDto) {
    return this.catalog.listStatuses(query.includeInactive ?? false);
  }

  @Post('statuses')
  @RequireAccess('medias', FULL)
  createStatus(@Body() body: MediaStatusDto) {
    return this.catalog.saveStatus(null, {
      name: body.name,
      color: body.color,
      ignoresDelay: body.ignoresDelay ?? false,
      active: body.active ?? true,
    });
  }

  @Patch('statuses/:id')
  @RequireAccess('medias', FULL)
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: MediaStatusDto) {
    return this.catalog.saveStatus(id, {
      name: body.name,
      color: body.color,
      ignoresDelay: body.ignoresDelay ?? false,
      active: body.active ?? true,
    });
  }
}
