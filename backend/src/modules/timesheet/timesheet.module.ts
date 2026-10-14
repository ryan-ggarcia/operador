import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { CrmModule } from '../crm/public/index.js';
import { ProjectsModule } from '../projects/public/index.js';
import { SettingsModule } from '../settings/public/index.js';
import { TimeEntriesService } from './entries/time-entries.service.js';
import { TIMESHEET_FACADE } from './public/timesheet.facade.js';
import {
  PrismaScheduleRepository,
  PrismaTimeEntryRepository,
} from './repositories/prisma-time-entry.repository.js';
import {
  SCHEDULE_REPOSITORY,
  TIME_ENTRY_REPOSITORY,
} from './repositories/time-entry.repository.js';
import { SchedulesService } from './schedules/schedules.service.js';
import { SchedulesController, TimesheetController } from './timesheet.controller.js';
import { TimesheetFacadeService } from './timesheet.facade.service.js';
import { TimesheetLifecycleListener } from './timesheet-lifecycle.listener.js';

@Module({
  imports: [AuthModule, CrmModule, ProjectsModule, SettingsModule],
  controllers: [TimesheetController, SchedulesController],
  providers: [
    TimeEntriesService,
    SchedulesService,
    TimesheetLifecycleListener,
    { provide: TIME_ENTRY_REPOSITORY, useClass: PrismaTimeEntryRepository },
    { provide: SCHEDULE_REPOSITORY, useClass: PrismaScheduleRepository },
    { provide: TIMESHEET_FACADE, useClass: TimesheetFacadeService },
  ],
  exports: [TIMESHEET_FACADE],
})
export class TimesheetModule {}
