import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../../shared/auth/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.js';
import { CurrentAccess, RequireAccess, type UserPermissions } from '../../auth/public/index.js';
import { DocumentCopyService } from '../copy/document-copy.service.js';
import {
  ApplyTemplateDto,
  ApplyTemplateJobDto,
  DuplicateProjectDto,
  JobDestinationDto,
  JobFromTemplateDto,
  ProjectFromTemplateDto,
  TemplateActiveDto,
  TemplateDto,
  TemplateListDto,
  TemplateTitleDto,
} from '../dto/templates.dto.js';
import { TemplatesService } from './templates.service.js';

function templateData(body: TemplateDto) {
  return {
    title: body.title,
    briefing: body.briefing ?? null,
    jobs: body.jobs.map((job) => ({
      title: job.title,
      responsibleId: job.responsibleId ?? null,
      statusId: job.statusId ?? null,
      briefing: job.briefing ?? null,
      tasks: job.tasks.map((task) => ({ title: task.title, responsibleId: task.responsibleId ?? null })),
    })),
  };
}

@Controller('project-templates')
@RequireAccess(['projects', 'jobs'])
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly copies: DocumentCopyService,
  ) {}

  @Get()
  list(@CurrentAccess() access: UserPermissions, @Query() query: TemplateListDto) {
    return this.templates.list(access, query.search, query.includeInactive);
  }

  /** Jobs de template (criar job a partir de template). */
  @Get('jobs')
  listJobs(@Query() query: TemplateListDto) {
    return this.templates.listJobs(query.search);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Body() body: TemplateDto) {
    return this.templates.create(user.id, access, templateData(body));
  }

  @Put(':id')
  update(@CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string, @Body() body: TemplateDto) {
    return this.templates.update(access, id, templateData(body));
  }

  @Put(':id/active')
  @HttpCode(HttpStatus.NO_CONTENT)
  setActive(@CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string, @Body() body: TemplateActiveDto) {
    return this.templates.setActive(access, id, body.active);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.remove(access, id);
  }

  @Post('from-project/:projectId')
  fromProject(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() body: TemplateTitleDto,
  ) {
    return this.templates.fromProject(user.id, access, projectId, body.title);
  }

  @Post('from-job/:jobId')
  fromJob(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() body: TemplateTitleDto,
  ) {
    return this.templates.fromJob(user.id, access, jobId, body.title);
  }

  /** Cria um projeto a partir do template. */
  @Post(':id/projects')
  createProject(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProjectFromTemplateDto,
  ) {
    return this.copies.createProjectFromTemplate(user.id, access, id, body);
  }

  /** Cria um job a partir de um job de template. */
  @Post('jobs/:templateJobId/jobs')
  createJob(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('templateJobId', ParseUUIDPipe) templateJobId: string,
    @Body() body: JobFromTemplateDto,
  ) {
    return this.copies.createJobFromTemplate(user.id, access, templateJobId, body);
  }
}

/** Duplicar e aplicar template em projetos e jobs existentes. */
@Controller()
export class CopiesController {
  constructor(private readonly copies: DocumentCopyService) {}

  @Post('projects/:id/duplicate')
  @RequireAccess('projects')
  duplicateProject(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DuplicateProjectDto,
  ) {
    return this.copies.duplicateProject(user.id, access, id, body.clientId);
  }

  @Post('projects/:id/apply-template')
  @HttpCode(HttpStatus.OK)
  @RequireAccess('projects')
  applyToProject(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApplyTemplateDto,
  ) {
    return this.copies.applyTemplateToProject(user.id, access, id, body.templateId);
  }

  @Post('jobs/:id/duplicate')
  @RequireAccess('jobs')
  duplicateJob(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: JobDestinationDto,
  ) {
    return this.copies.duplicateJob(user.id, access, id, body);
  }

  @Post('jobs/:id/apply-template')
  @HttpCode(HttpStatus.OK)
  @RequireAccess('jobs')
  applyToJob(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApplyTemplateJobDto,
  ) {
    return this.copies.applyTemplateToJob(user.id, access, id, body.templateJobId);
  }
}
