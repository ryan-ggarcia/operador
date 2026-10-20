import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../shared/auth/auth-user.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import {
  CurrentAccess,
  LoadAccess,
  RequireAccess,
  RequireAdministrator,
  type UserPermissions,
} from '../auth/public/index.js';
import {
  AssignScheduleDto,
  EntryListDto,
  ManualEntryDto,
  ScheduleDto,
  StartTimerDto,
  StopTimerDto,
  UpdateEntryDto,
  UpdateScheduleDto,
} from './dto/timesheet.dto.js';
import { TimeEntriesService } from './entries/time-entries.service.js';
import { SchedulesService } from './schedules/schedules.service.js';
import type { TimesheetDocType } from './public/timesheet.facade.js';

/** Timesheet: quem tem acesso a algum módulo de documentos. */
@Controller('timesheet')
@RequireAccess(['jobs', 'medias', 'productions'])
export class TimesheetController {
  constructor(private readonly entries: TimeEntriesService) {}

  /** Cronômetro em andamento do usuário (ou null). */
  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.entries.current(user.id);
  }

  @Post('start')
  start(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Body() body: StartTimerDto,
  ) {
    return this.entries.start(user.id, access, body);
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  stop(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Body() body: StopTimerDto,
  ) {
    return this.entries.stop(user.id, access, body);
  }

  /** Cronômetros em andamento da equipe (leitura total em jobs). */
  @Get('running')
  running(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions) {
    return this.entries.running(user.id, access);
  }

  @Get('entries')
  list(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Query() query: EntryListDto,
  ) {
    return this.entries.list(user.id, access, query);
  }

  @Post('entries')
  createManual(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Body() body: ManualEntryDto,
  ) {
    return this.entries.createManual(user.id, access, body);
  }

  @Patch('entries/:id')
  update(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEntryDto,
  ) {
    return this.entries.update(user.id, access, id, body);
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.entries.remove(user.id, access, id);
  }

  /** Estimado × realizado e apontamentos de um documento. */
  @Get('documents/:docType/:docId')
  summary(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('docType') docType: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.entries.documentSummary(user.id, access, parseDocType(docType), docId);
  }
}

function parseDocType(value: string): TimesheetDocType {
  if (value === 'job' || value === 'task' || value === 'project') return value;
  throw new BadRequestException('Tipo de documento inválido.');
}

@Controller('work-schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @RequireAdministrator()
  list() {
    return this.schedules.list();
  }

  /** Jornada do próprio usuário. */
  @Get('mine')
  @LoadAccess()
  mine(@CurrentUser() user: AuthUser) {
    return this.schedules.forUser(user.id);
  }

  @Post()
  @RequireAdministrator()
  create(@Body() body: ScheduleDto) {
    const { isDefault, ...data } = body;
    return this.schedules.create(
      { ...data, productiveGoalMinutesPerDay: data.productiveGoalMinutesPerDay ?? null },
      isDefault,
    );
  }

  @Patch(':id')
  @RequireAdministrator()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateScheduleDto) {
    return this.schedules.update(id, body);
  }

  @Delete(':id')
  @RequireAdministrator()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedules.remove(id);
  }

  /** Move usuários para a jornada a partir de amanhã. */
  @Put(':id/users')
  @RequireAdministrator()
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() body: AssignScheduleDto) {
    return this.schedules.assign(id, body.userIds);
  }
}
