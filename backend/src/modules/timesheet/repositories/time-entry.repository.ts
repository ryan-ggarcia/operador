import type { Page } from '../../../shared/validation/pagination.js';

export const TIME_ENTRY_REPOSITORY = Symbol('TIME_ENTRY_REPOSITORY');
export const SCHEDULE_REPOSITORY = Symbol('SCHEDULE_REPOSITORY');

export type EntryDocType = 'JOB' | 'TASK' | 'MEDIA' | 'PRODUCTION' | 'PROJECT';
export type EntrySource = 'TIMER' | 'MANUAL';
export type EntryKind = 'NORMAL' | 'REWORK';
export type EntrySituation = 'RUNNING' | 'DONE';

export interface TimeEntryRecord {
  id: string;
  userId: string;
  docType: EntryDocType;
  docId: string;
  projectId: string | null;
  clientId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
  source: EntrySource;
  kind: EntryKind;
  description: string | null;
  situation: EntrySituation;
  hourlyCost: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTimeEntry {
  userId: string;
  docType: EntryDocType;
  docId: string;
  projectId: string | null;
  clientId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
  source: EntrySource;
  kind: EntryKind;
  description: string | null;
  situation: EntrySituation;
  hourlyCost: number | null;
}

export interface TimeEntryChanges {
  startedAt?: Date;
  endedAt?: Date | null;
  minutes?: number;
  source?: EntrySource;
  kind?: EntryKind;
  description?: string | null;
  situation?: EntrySituation;
}

export interface DocRef {
  docType: EntryDocType;
  docIds: string[];
}

export interface TimeEntryFilter {
  userIds?: string[];
  from?: Date;
  to?: Date;
  /** Apontamentos de qualquer um destes documentos. */
  docs?: DocRef[];
  projectId?: string;
  clientId?: string;
  situation?: EntrySituation;
  source?: EntrySource;
  limit: number;
  offset: number;
}

/** Apontamentos de horas (schema "timesheet"). */
export interface TimeEntryRepository {
  list(filter: TimeEntryFilter): Promise<Page<TimeEntryRecord> & { totalMinutes: number }>;
  findById(id: string): Promise<TimeEntryRecord | null>;
  findRunningByUser(userId: string): Promise<TimeEntryRecord | null>;
  findRunning(filter: { docs?: DocRef[]; projectId?: string }): Promise<TimeEntryRecord[]>;
  /** Cria; se o usuário já tem um cronômetro rodando, lança RunningTimerExistsError. */
  create(data: NewTimeEntry, actorId: string): Promise<TimeEntryRecord>;
  update(id: string, changes: TimeEntryChanges, actorId: string): Promise<TimeEntryRecord>;
  delete(id: string): Promise<void>;
  /** Minutos concluídos por documento. */
  sumMinutes(docs: DocRef[]): Promise<{ docType: EntryDocType; docId: string; minutes: number }[]>;
}

/** O índice único parcial barrou um segundo cronômetro do usuário. */
export class RunningTimerExistsError extends Error {}

export interface ScheduleRecord {
  id: string;
  title: string;
  isDefault: boolean;
  productiveGoalMinutesPerDay: number | null;
  periods: Record<string, { start: string; end: string }[]>;
  active: boolean;
}

export interface ScheduleData {
  title: string;
  productiveGoalMinutesPerDay: number | null;
  periods: Record<string, { start: string; end: string }[]>;
}

export interface UserScheduleRecord {
  userId: string;
  scheduleId: string;
  /** AAAA-MM-DD */
  validFrom: string;
}

/** Jornadas de trabalho (schema "timesheet"). */
export interface ScheduleRepository {
  list(): Promise<ScheduleRecord[]>;
  findById(id: string): Promise<ScheduleRecord | null>;
  findDefault(): Promise<ScheduleRecord | null>;
  create(data: ScheduleData, isDefault: boolean): Promise<ScheduleRecord>;
  update(id: string, data: Partial<ScheduleData>): Promise<ScheduleRecord>;
  /** Torna esta a jornada padrão (só uma). */
  makeDefault(id: string): Promise<void>;
  /** Remove a jornada e passa os usuários dela para outra, a partir da data. */
  remove(id: string, moveTo: string, validFrom: string): Promise<void>;
  listAssignments(): Promise<UserScheduleRecord[]>;
  /** Grava a jornada dos usuários a partir da data (substitui a do mesmo dia). */
  assign(userIds: string[], scheduleId: string, validFrom: string): Promise<void>;
}
