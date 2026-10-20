import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { localDate } from '../../../shared/time/timezone.js';
import { AUTH_FACADE, type AuthFacade } from '../../auth/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import { nextDay, periodsError, weeklyMinutes, type WeekPeriods } from '../domain/time-rules.js';
import {
  SCHEDULE_REPOSITORY,
  type ScheduleData,
  type ScheduleRecord,
  type ScheduleRepository,
  type UserScheduleRecord,
} from '../repositories/time-entry.repository.js';

export interface ScheduleView extends ScheduleRecord {
  weeklyMinutes: number;
  /** Usuários com esta jornada hoje. */
  userIds: string[];
}

/** Jornada vigente de cada usuário na data (a última com validFrom ≤ data). */
export function currentAssignments(rows: UserScheduleRecord[], date: string): Map<string, string> {
  const current = new Map<string, string>();
  for (const row of [...rows].sort((a, b) => a.validFrom.localeCompare(b.validFrom))) {
    if (row.validFrom <= date) current.set(row.userId, row.scheduleId);
  }
  return current;
}

/** Jornadas de trabalho. Trocar a jornada de alguém vale a partir de amanhã. */
@Injectable()
export class SchedulesService {
  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepository,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
  ) {}

  /** Quem nunca foi atribuído a uma jornada usa a padrão e não entra em userIds. */
  async list(): Promise<ScheduleView[]> {
    const [schedules, rows, today] = await Promise.all([
      this.schedules.list(),
      this.schedules.listAssignments(),
      this.today(),
    ]);
    const current = currentAssignments(rows, today);
    return schedules.map((schedule) => ({
      ...schedule,
      weeklyMinutes: weeklyMinutes(schedule.periods),
      userIds: [...current.entries()]
        .filter(([, scheduleId]) => scheduleId === schedule.id)
        .map(([userId]) => userId),
    }));
  }

  /** Jornada do usuário hoje (a padrão, se nunca foi atribuído). */
  async forUser(userId: string): Promise<ScheduleView | null> {
    const [rows, today] = await Promise.all([this.schedules.listAssignments(), this.today()]);
    const scheduleId = currentAssignments(rows.filter((row) => row.userId === userId), today).get(userId);
    const schedule = scheduleId ? await this.schedules.findById(scheduleId) : await this.schedules.findDefault();
    return schedule ? { ...schedule, weeklyMinutes: weeklyMinutes(schedule.periods), userIds: [userId] } : null;
  }

  async create(data: ScheduleData, isDefault = false): Promise<ScheduleRecord> {
    this.validate(data);
    const hasDefault = Boolean(await this.schedules.findDefault());
    const created = await this.schedules.create({ ...data, title: data.title.trim() }, !hasDefault);
    if (isDefault && hasDefault) await this.schedules.makeDefault(created.id);
    return (await this.schedules.findById(created.id))!;
  }

  async update(id: string, data: Partial<ScheduleData> & { isDefault?: boolean }): Promise<ScheduleRecord> {
    const current = await this.require(id);
    const { isDefault, ...changes } = data;
    this.validate({ ...current, ...changes });
    if (isDefault === false && current.isDefault) {
      throw new BadRequestException('Escolha outra jornada como padrão em vez de tirar a padrão.');
    }
    await this.schedules.update(id, { ...changes, title: changes.title?.trim() });
    if (isDefault && !current.isDefault) await this.schedules.makeDefault(id);
    return (await this.schedules.findById(id))!;
  }

  /** Excluir leva os usuários da jornada para a padrão (a partir de amanhã). */
  async remove(id: string): Promise<void> {
    const schedule = await this.require(id);
    if (schedule.isDefault) throw new BadRequestException('A jornada padrão não pode ser excluída.');
    const defaultSchedule = await this.schedules.findDefault();
    if (!defaultSchedule) throw new BadRequestException('Não há jornada padrão para receber os usuários.');
    await this.schedules.remove(id, defaultSchedule.id, nextDay(await this.today()));
  }

  /** Move usuários para a jornada a partir de amanhã. */
  async assign(id: string, userIds: string[]): Promise<{ validFrom: string }> {
    await this.require(id);
    const unique = [...new Set(userIds)];
    const users = await this.auth.getUsers(unique);
    if (users.length !== unique.length) throw new BadRequestException('Usuário não encontrado.');
    const validFrom = nextDay(await this.today());
    await this.schedules.assign(unique, id, validFrom);
    return { validFrom };
  }

  private validate(data: ScheduleData): void {
    if (!data.title?.trim()) throw new BadRequestException('Informe o título da jornada.');
    const error = periodsError(data.periods as WeekPeriods);
    if (error) throw new BadRequestException(error);
    if (weeklyMinutes(data.periods) === 0) throw new BadRequestException('A jornada precisa de pelo menos um horário.');
  }

  private async require(id: string): Promise<ScheduleRecord> {
    const schedule = await this.schedules.findById(id);
    if (!schedule) throw new NotFoundException('Jornada não encontrada.');
    return schedule;
  }

  private async today(): Promise<string> {
    const { timezone } = await this.settings.getAgency();
    return localDate(new Date(), timezone);
  }
}
