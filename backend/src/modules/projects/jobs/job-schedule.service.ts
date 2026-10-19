import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { localDate } from '../../../shared/time/timezone.js';
import type { UserPermissions } from '../../auth/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import { DocumentCopyService } from '../copy/document-copy.service.js';
import { fromMoment, toMoment } from '../copy/local-shift.js';
import {
  daysBetween,
  recurrenceDates,
  ScheduleRuleError,
  shiftMoment,
  type RecurrenceRule,
  type ShiftUnit,
} from '../domain/schedule-rules.js';
import { JOB_REPOSITORY, type JobRepository } from '../repositories/job.repository.js';
import { JobsService } from './jobs.service.js';

export interface PostponeInput {
  jobIds: string[];
  amount: number;
  unit: ShiftUnit;
  target: 'JOB' | 'TASKS' | 'BOTH';
  businessDaysOnly?: boolean;
}

export interface PostponeResult {
  jobs: number;
  tasks: number;
  /** Jobs e tarefas sem prazo (ou fechados), que ficaram como estavam. */
  skipped: number;
}

/** Recorrência de jobs e adiamento de prazos (docs/operand/jobs.md, 2.5). */
@Injectable()
export class JobScheduleService {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
    private readonly jobsService: JobsService,
    private readonly copies: DocumentCopyService,
  ) {}

  /**
   * Cria as próximas ocorrências do job, a partir do prazo dele, no mesmo
   * projeto. O job original vira a 1ª da série ("Job recorrente 1/Y").
   */
  async createRecurrence(
    userId: string,
    access: UserPermissions,
    jobId: string,
    rule: RecurrenceRule,
  ): Promise<{ total: number; jobIds: string[] }> {
    const source = await this.jobsService.assertEditable(userId, access, jobId);
    if (source.recurrence) throw new BadRequestException('Este job já faz parte de uma recorrência.');
    if (!source.deadline) throw new BadRequestException('Defina o prazo do job antes de criar a recorrência.');
    const timezone = (await this.settings.getAgency()).timezone;
    const base = localDate(source.deadline, timezone);
    const dates = this.rule(() => recurrenceDates(base, rule));
    const total = dates.length + 1;

    await this.jobs.setRecurrence(source.id, { seriesId: source.id, position: 1, total, rule });
    const jobIds = [source.id];
    for (const [index, date] of dates.entries()) {
      const id = await this.copies.copyJob(
        userId,
        access,
        source,
        { clientId: source.clientId, projectId: source.projectId },
        daysBetween(base, date),
      );
      await this.jobs.setRecurrence(id, { seriesId: source.id, position: index + 2, total, rule });
      jobIds.push(id);
    }
    return { total, jobIds };
  }

  /** Adia o prazo de jobs, das tarefas abertas deles ou dos dois. Itens sem prazo ficam de fora. */
  async postpone(userId: string, access: UserPermissions, input: PostponeInput): Promise<PostponeResult> {
    const timezone = (await this.settings.getAgency()).timezone;
    const businessDaysOnly = input.businessDaysOnly ?? false;
    const shift = (instant: Date, minutesOverride?: number) => {
      const moment = toMoment(instant, timezone);
      return this.rule(() =>
        shiftMoment({ ...moment, minutes: minutesOverride ?? moment.minutes }, input.amount, input.unit, businessDaysOnly),
      );
    };

    // Confere tudo antes de mexer: ou adia todos, ou nenhum.
    const jobs = [];
    for (const id of [...new Set(input.jobIds)]) jobs.push(await this.jobsService.assertEditable(userId, access, id));

    const result: PostponeResult = { jobs: 0, tasks: 0, skipped: 0 };
    for (const job of jobs) {
      if (input.target !== 'TASKS') {
        if (job.deadline) {
          // Prazo sem hora vale até o fim do dia: adia a partir de 23:59.
          const moved = shift(job.deadline, job.deadlineHasTime ? undefined : 23 * 60 + 59);
          await this.jobsService.update(userId, access, job.id, {
            deadline: job.deadlineHasTime ? fromMoment(moved, job.deadline, timezone).toISOString() : moved.date,
            deadlineHasTime: job.deadlineHasTime,
          });
          result.jobs++;
        } else {
          result.skipped++;
        }
      }
      if (input.target !== 'JOB') {
        for (const task of await this.jobs.listTasks(job.id)) {
          if (task.situation !== 'OPEN') continue;
          if (!task.deadline) {
            result.skipped++;
            continue;
          }
          const deadline = fromMoment(shift(task.deadline), task.deadline, timezone);
          await this.jobsService.updateTask(userId, access, task.id, { deadline });
          result.tasks++;
        }
      }
    }
    return result;
  }

  private rule<T>(check: () => T): T {
    try {
      return check();
    } catch (error) {
      if (error instanceof ScheduleRuleError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
