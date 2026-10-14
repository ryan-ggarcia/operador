import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQuery } from '../../../shared/validation/pagination.js';
import { ToBoolean, Trim } from '../../../shared/validation/query-transforms.js';
import type { TimesheetDocType } from '../public/timesheet.facade.js';

const DOC_TYPES: TimesheetDocType[] = ['job', 'task', 'project'];
const KINDS = ['NORMAL', 'REWORK'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class StartTimerDto {
  @IsIn(DOC_TYPES)
  docType: TimesheetDocType;

  @IsUUID()
  docId: string;

  @IsOptional() @Trim() @IsString() @MaxLength(1000)
  description?: string | null;
}

export class StopTimerDto {
  /** Cronômetro de outra pessoa (gestor); sem id, o próprio. */
  @IsOptional() @IsUUID()
  entryId?: string;

  @IsOptional() @Trim() @IsString() @MaxLength(1000)
  description?: string | null;

  @IsOptional() @IsIn(KINDS)
  kind?: 'NORMAL' | 'REWORK';
}

export class ManualEntryDto {
  @IsIn(DOC_TYPES)
  docType: TimesheetDocType;

  @IsUUID()
  docId: string;

  @IsString() @Matches(DATE)
  date: string;

  @IsInt() @Min(1) @Max(1440)
  minutes: number;

  @IsOptional() @IsIn(KINDS)
  kind?: 'NORMAL' | 'REWORK';

  @IsOptional() @Trim() @IsString() @MaxLength(1000)
  description?: string | null;

  @IsOptional() @IsUUID()
  userId?: string;
}

export class UpdateEntryDto {
  @IsOptional() @Trim() @IsString() @MaxLength(1000)
  description?: string | null;

  @IsOptional() @IsIn(KINDS)
  kind?: 'NORMAL' | 'REWORK';

  @IsOptional() @IsInt() @Min(1) @Max(1440)
  minutes?: number;

  @IsOptional() @IsString() @Matches(DATE)
  date?: string;
}

export class EntryListDto extends PageQuery {
  @IsOptional() @ToBoolean() @IsBoolean()
  mine?: boolean;

  @IsOptional() @IsUUID()
  userId?: string;

  @IsOptional() @IsString() @Matches(DATE)
  from?: string;

  @IsOptional() @IsString() @Matches(DATE)
  to?: string;

  @IsOptional() @IsIn(DOC_TYPES)
  docType?: TimesheetDocType;

  @IsOptional() @IsUUID()
  docId?: string;

  @IsOptional() @IsUUID()
  clientId?: string;

  @IsOptional() @IsUUID()
  projectId?: string;

  @IsOptional() @IsIn(['RUNNING', 'DONE'])
  situation?: 'RUNNING' | 'DONE';

  @IsOptional() @IsIn(['TIMER', 'MANUAL'])
  source?: 'TIMER' | 'MANUAL';
}

export class ScheduleDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  title: string;

  @IsOptional() @IsInt() @Min(0) @Max(1440)
  productiveGoalMinutesPerDay?: number | null;

  /** Dia da semana (0 = domingo) → [{ start: "08:30", end: "12:00" }]. */
  @IsObject()
  periods: Record<string, { start: string; end: string }[]>;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  title?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1440)
  productiveGoalMinutesPerDay?: number | null;

  @IsOptional() @IsObject()
  periods?: Record<string, { start: string; end: string }[]>;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

export class AssignScheduleDto {
  @IsArray() @ArrayNotEmpty() @IsUUID('all', { each: true })
  userIds: string[];
}
