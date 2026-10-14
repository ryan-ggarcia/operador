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
  CreateJobDto,
  JobListDto,
  MembersDto,
  MoveJobDto,
  TaskDto,
  UpdateJobDto,
  UpdateTaskDto,
} from '../dto/projects.dto.js';
import { JobsService } from './jobs.service.js';

@Controller('jobs')
@RequireAccess('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly comments: CommentsService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Query() query: JobListDto,
  ) {
    return this.jobs.list(user.id, access, query);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.get(user.id, access, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Body() body: CreateJobDto,
  ) {
    return this.jobs.create(user.id, access, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateJobDto,
  ) {
    return this.jobs.update(user.id, access, id, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.changeSituation(user.id, access, id, 'complete');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.changeSituation(user.id, access, id, 'cancel');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.changeSituation(user.id, access, id, 'reopen');
  }

  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  move(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MoveJobDto,
  ) {
    return this.jobs.move(user.id, access, id, body.projectId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMembers(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MembersDto,
  ) {
    return this.jobs.addMembers(user.id, access, id, body.userIds);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.jobs.removeMember(user.id, access, id, memberId);
  }

  @Get(':id/history')
  history(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.history(user.id, access, id);
  }

  @Post(':id/tasks')
  createTask(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TaskDto,
  ) {
    return this.jobs.createTask(user.id, access, id, body);
  }

  @Get(':id/comments')
  listComments(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comments.list(user.id, access, 'JOB', id);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CommentDto,
  ) {
    return this.comments.create(user.id, access, 'JOB', id, body);
  }
}

@Controller('tasks')
@RequireAccess('jobs')
export class TasksController {
  constructor(private readonly jobs: JobsService) {}

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTaskDto,
  ) {
    return this.jobs.updateTask(user.id, access, id, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.changeTaskSituation(user.id, access, id, 'complete');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.changeTaskSituation(user.id, access, id, 'cancel');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobs.changeTaskSituation(user.id, access, id, 'reopen');
  }
}
