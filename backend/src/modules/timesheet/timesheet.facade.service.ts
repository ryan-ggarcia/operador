import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { hasLevel, type UserPermissions } from '../auth/public/index.js';
import { canSeeOthers } from './domain/time-rules.js';
import { TimeEntriesService } from './entries/time-entries.service.js';
import type { JobHours, RunningTimer, TimesheetDocType, TimesheetFacade } from './public/timesheet.facade.js';
import {
  TIME_ENTRY_REPOSITORY,
  type EntryDocType,
  type TimeEntryRepository,
} from './repositories/time-entry.repository.js';

const TO_ENTRY: Record<TimesheetDocType, EntryDocType> = { job: 'JOB', task: 'TASK', project: 'PROJECT' };
const FROM_ENTRY: Partial<Record<EntryDocType, TimesheetDocType>> = { JOB: 'job', TASK: 'task', PROJECT: 'project' };

@Injectable()
export class TimesheetFacadeService implements TimesheetFacade {
  constructor(
    @Inject(TIME_ENTRY_REPOSITORY) private readonly entries: TimeEntryRepository,
    private readonly timeEntries: TimeEntriesService,
  ) {}

  async getJobHoursForUser(userId: string, access: UserPermissions, jobId: string): Promise<JobHours> {
    // Mesma exigência do TimesheetController.
    if (!(['jobs', 'medias', 'productions'] as const).some((module) => hasLevel(access, module, 1))) {
      throw new ForbiddenException('Sem acesso ao timesheet.');
    }
    const summary = await this.timeEntries.documentSummary(userId, access, 'job', jobId);
    return {
      estimatedMinutes: summary.estimatedMinutes,
      realizedMinutes: summary.realizedMinutes,
      balanceMinutes: summary.balanceMinutes,
      runningCount: summary.runningUserIds.length,
      onlyOwnEntries: !canSeeOthers(access),
      entries: summary.entries.map((entry) => ({
        user: entry.user?.name ?? null,
        doc: entry.doc.title,
        startedAt: entry.startedAt,
        minutes: entry.minutes,
        kind: entry.kind,
        description: entry.description,
        running: entry.situation === 'RUNNING',
      })),
    };
  }

  async getMinutesBySource(docType: TimesheetDocType, ids: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
    const sums = await this.entries.sumMinutes([{ docType: TO_ENTRY[docType], docIds: [...new Set(ids)] }]);
    for (const sum of sums) result[sum.docId] = sum.minutes;
    return result;
  }

  async getRunningTimers(): Promise<RunningTimer[]> {
    const running = await this.entries.findRunning({});
    return running.flatMap((entry) => {
      const docType = FROM_ENTRY[entry.docType];
      return docType
        ? [{ userId: entry.userId, docType, docId: entry.docId, startedAt: entry.startedAt }]
        : [];
    });
  }
}
