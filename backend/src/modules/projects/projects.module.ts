import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { FilesModule } from '../files/public/index.js';
import { NotificationsModule } from '../notifications/public/index.js';
import { CrmModule } from '../crm/public/index.js';
import { SettingsModule } from '../settings/public/index.js';
import { ApprovalsController } from './approvals/approvals.controller.js';
import { ApprovalsService } from './approvals/approvals.service.js';
import { CommentsService } from './comments/comments.service.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentLifecycleService } from './document-lifecycle.service.js';
import { JobsController, TasksController } from './jobs/jobs.controller.js';
import { JobsService } from './jobs/jobs.service.js';
import { NamingService } from './naming.service.js';
import { ProjectsController } from './projects/projects.controller.js';
import { ProjectsService } from './projects/projects.service.js';
import { ProjectsFacadeService } from './projects.facade.service.js';
import { PROJECTS_FACADE } from './public/projects.facade.js';
import { APPROVAL_REPOSITORY } from './repositories/approval.repository.js';
import { JOB_REPOSITORY } from './repositories/job.repository.js';
import { PrismaApprovalRepository } from './repositories/prisma-approval.repository.js';
import { PrismaJobRepository } from './repositories/prisma-job.repository.js';
import { PrismaProjectRepository } from './repositories/prisma-project.repository.js';
import {
  PrismaCommentRepository,
  PrismaStatusRepository,
} from './repositories/prisma-status.repository.js';
import { PROJECT_REPOSITORY } from './repositories/project.repository.js';
import {
  COMMENT_REPOSITORY,
  STATUS_REPOSITORY,
} from './repositories/status.repository.js';
import {
  BriefingsController,
  CommentsController,
  StatusesController,
} from './statuses/statuses.controller.js';
import { StatusesService } from './statuses/statuses.service.js';
import { ProjectsFileOwner } from './projects-file-owner.js';
import { ProjectsNotifier } from './projects-notifier.js';

@Module({
  imports: [AuthModule, FilesModule, NotificationsModule, CrmModule, SettingsModule],
  controllers: [
    ProjectsController,
    JobsController,
    TasksController,
    StatusesController,
    BriefingsController,
    CommentsController,
    ApprovalsController,
  ],
  providers: [
    ProjectsFileOwner,
    ProjectsNotifier,
    ProjectsService,
    JobsService,
    StatusesService,
    CommentsService,
    DocumentAccessService,
    ApprovalsService,
    NamingService,
    DocumentLifecycleService,
    { provide: PROJECT_REPOSITORY, useClass: PrismaProjectRepository },
    { provide: JOB_REPOSITORY, useClass: PrismaJobRepository },
    { provide: STATUS_REPOSITORY, useClass: PrismaStatusRepository },
    { provide: COMMENT_REPOSITORY, useClass: PrismaCommentRepository },
    { provide: APPROVAL_REPOSITORY, useClass: PrismaApprovalRepository },
    { provide: PROJECTS_FACADE, useClass: ProjectsFacadeService },
  ],
  exports: [PROJECTS_FACADE],
})
export class ProjectsModule {}
