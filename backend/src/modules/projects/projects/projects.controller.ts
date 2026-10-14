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
  RequireAccess,
  type UserPermissions,
} from '../../auth/public/index.js';
import { CommentsService } from '../comments/comments.service.js';
import {
  CommentDto,
  CreateProjectDto,
  MembersDto,
  ProjectListDto,
  ReopenDto,
  UpdateProjectDto,
} from '../dto/projects.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@RequireAccess('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly comments: CommentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Query() query: ProjectListDto,
  ) {
    return this.projects.list(user.id, access, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.get(user.id, access, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Body() body: CreateProjectDto,
  ) {
    return this.projects.create(user.id, access, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projects.update(user.id, access, id, body);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  unlock(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.unlock(user.id, access, id);
  }

  /** Arquivar = concluir o projeto e todos os jobs. */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.changeSituation(user.id, access, id, 'archive');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.changeSituation(user.id, access, id, 'cancel');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReopenDto,
  ) {
    return this.projects.changeSituation(user.id, access, id, 'reopen', body.reopenDocuments);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMembers(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MembersDto,
  ) {
    return this.projects.addMembers(user.id, access, id, body.userIds);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.projects.removeMember(user.id, access, id, memberId);
  }

  @Put(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  favorite(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.setFavorite(user.id, access, id, true);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfavorite(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.setFavorite(user.id, access, id, false);
  }

  @Get(':id/history')
  history(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.history(user.id, access, id);
  }

  @Get(':id/comments')
  listComments(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comments.list(user.id, access, 'PROJECT', id);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CommentDto,
  ) {
    return this.comments.create(user.id, access, 'PROJECT', id, body);
  }
}
