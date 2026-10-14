import {
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
import type { AuthUser } from '../../../shared/auth/auth-user.js';
import { CurrentUser } from '../../../shared/auth/current-user.decorator.js';
import {
  CurrentAccess,
  LoadAccess,
  type UserPermissions,
} from '../../auth/public/index.js';
import { CommentsService } from '../comments/comments.service.js';
import {
  CreateBriefingDto,
  CreateStatusDto,
  PinDto,
  ReorderStatusDto,
  StatusListDto,
  UpdateBriefingDto,
  UpdateCommentDto,
  UpdateStatusDto,
} from '../dto/projects.dto.js';
import { StatusesService } from './statuses.service.js';

/** Status de projetos (docType=PROJECT) e de jobs e tarefas (docType=JOB). */
@Controller('project-statuses')
@LoadAccess()
export class StatusesController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  list(@Query() query: StatusListDto) {
    return this.statuses.list(query.docType, query.includeInactive ?? false);
  }

  @Post()
  create(@CurrentAccess() access: UserPermissions, @Body() body: CreateStatusDto) {
    return this.statuses.create(access, body.docType, {
      name: body.name,
      color: body.color,
      active: true,
      ignoresDelay: body.ignoresDelay ?? false,
      groupId: body.groupId ?? null,
    });
  }

  @Put('order')
  reorder(@CurrentAccess() access: UserPermissions, @Body() body: ReorderStatusDto) {
    return this.statuses.reorder(access, body.docType, body.ids);
  }

  @Patch(':id')
  update(
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStatusDto,
  ) {
    return this.statuses.update(access, id, body);
  }
}

@Controller('predefined-briefings')
@LoadAccess()
export class BriefingsController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  list(@Query() query: StatusListDto) {
    return this.statuses.listBriefings(query.docType, query.includeInactive ?? false);
  }

  @Post()
  create(@CurrentAccess() access: UserPermissions, @Body() body: CreateBriefingDto) {
    return this.statuses.createBriefing(access, body.docType, body.title, body.html);
  }

  @Patch(':id')
  update(
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBriefingDto,
  ) {
    return this.statuses.updateBriefing(access, id, body);
  }
}

/** Editar, apagar e fixar comentários de projetos e jobs. */
@Controller('comments')
@LoadAccess()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCommentDto,
  ) {
    return this.comments.update(user.id, access, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comments.remove(user.id, access, id);
  }

  @Put(':id/pin')
  pin(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PinDto,
  ) {
    return this.comments.setPinned(user.id, access, id, body.pinned);
  }
}
