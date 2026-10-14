import { Inject, Injectable } from '@nestjs/common';
import type { RunningTimer, TimesheetDocType, TimesheetFacade } from './public/timesheet.facade.js';
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
  ) {}

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
