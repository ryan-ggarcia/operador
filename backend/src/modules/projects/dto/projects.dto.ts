import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQuery } from '../../../shared/validation/pagination.js';
import { ToArray, ToBoolean, Trim } from '../../../shared/validation/query-transforms.js';
import type { JobSituation } from '../domain/job-rules.js';
import type { ProjectSituation } from '../domain/project-rules.js';

const PROJECT_SITUATIONS: ProjectSituation[] = ['OPEN', 'ARCHIVED', 'CANCELED'];
const JOB_SITUATIONS: JobSituation[] = ['OPEN', 'DONE', 'CANCELED'];
/** Data ("AAAA-MM-DD") ou data e hora ISO. */
const DATE_OR_DATETIME = /^\d{4}-\d{2}-\d{2}(T.+)?$/;

// ---------- Projetos ----------

export class ProjectListDto extends PageQuery {
  @IsOptional() @Trim() @IsString()
  search?: string;

  @IsOptional() @ToArray() @IsIn(PROJECT_SITUATIONS, { each: true })
  situations?: ProjectSituation[];

  @IsOptional() @IsUUID()
  clientId?: string;

  @IsOptional() @ToArray() @IsUUID('all', { each: true })
  statusIds?: string[];

  @IsOptional() @ToBoolean() @IsBoolean()
  withoutStatus?: boolean;

  @IsOptional() @IsUUID()
  responsibleId?: string;

  @IsOptional() @ToBoolean() @IsBoolean()
  favoritesOnly?: boolean;
}

export class CreateProjectDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;

  @IsUUID()
  clientId: string;

  @IsOptional() @IsString()
  description?: string | null;

  @IsOptional() @IsBoolean()
  hidden?: boolean;
}

export class UpdateProjectDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title?: string;

  @IsOptional() @IsString()
  description?: string | null;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @IsBoolean()
  hidden?: boolean;

  @IsOptional() @Type(() => Date) @IsDate()
  desiredDeadline?: Date | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  budget?: number;
}

export class ReopenDto {
  /** Reabrir também os jobs do projeto. */
  @IsOptional() @IsBoolean()
  reopenDocuments?: boolean;
}

export class MembersDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @IsUUID('all', { each: true })
  userIds: string[];
}

// ---------- Jobs ----------

export class JobListDto extends PageQuery {
  @IsOptional() @Trim() @IsString()
  search?: string;

  @IsOptional() @ToArray() @IsIn(JOB_SITUATIONS, { each: true })
  situations?: JobSituation[];

  @IsOptional() @IsUUID()
  clientId?: string;

  @IsOptional() @IsUUID()
  projectId?: string;

  @IsOptional() @ToArray() @IsUUID('all', { each: true })
  responsibleIds?: string[];

  @IsOptional() @ToArray() @IsUUID('all', { each: true })
  statusIds?: string[];

  @IsOptional() @ToBoolean() @IsBoolean()
  withoutStatus?: boolean;

  /** "Minha pauta". */
  @IsOptional() @ToBoolean() @IsBoolean()
  mine?: boolean;

  @IsOptional() @ToBoolean() @IsBoolean()
  overdue?: boolean;

  @IsOptional() @Type(() => Date) @IsDate()
  deadlineFrom?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  deadlineTo?: Date;

  @IsOptional() @IsIn(['deadline', 'createdAt', 'number'])
  orderBy?: 'deadline' | 'createdAt' | 'number';
}

export class CreateJobDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;

  @IsUUID()
  clientId: string;

  /** Sem projeto, o job vai para o projeto "Geral" do cliente. */
  @IsOptional() @IsUUID()
  projectId?: string | null;

  @IsOptional() @IsUUID()
  clientContactId?: string | null;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  startAt?: Date | null;

  /** "AAAA-MM-DD" (vale até o fim do dia) ou data e hora ISO. */
  @IsOptional() @IsString() @Matches(DATE_OR_DATETIME)
  deadline?: string | null;

  @IsOptional() @IsBoolean()
  deadlineHasTime?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(100_000)
  estimatedMinutes?: number | null;

  @IsOptional() @IsString()
  briefing?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID('all', { each: true })
  memberIds?: string[];
}

export class UpdateJobDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title?: string;

  @IsOptional() @IsUUID()
  clientContactId?: string | null;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  startAt?: Date | null;

  @IsOptional() @IsString() @Matches(DATE_OR_DATETIME)
  deadline?: string | null;

  @IsOptional() @IsBoolean()
  deadlineHasTime?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(100_000)
  estimatedMinutes?: number | null;

  @IsOptional() @IsString()
  briefing?: string | null;
}

export class MoveJobDto {
  @IsUUID()
  projectId: string;
}

export class TaskDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  startAt?: Date | null;

  @IsOptional() @Type(() => Date) @IsDate()
  deadline?: Date | null;
}

export class UpdateTaskDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title?: string;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  startAt?: Date | null;

  @IsOptional() @Type(() => Date) @IsDate()
  deadline?: Date | null;

  @IsOptional() @IsInt() @Min(0)
  order?: number;
}

// ---------- Status, briefings e comentários ----------

export class StatusListDto {
  @IsIn(['PROJECT', 'JOB'])
  docType: 'PROJECT' | 'JOB';

  @IsOptional() @ToBoolean() @IsBoolean()
  includeInactive?: boolean;
}

export class CreateStatusDto {
  @IsIn(['PROJECT', 'JOB'])
  docType: 'PROJECT' | 'JOB';

  @Trim() @IsString() @IsNotEmpty() @MaxLength(60)
  name: string;

  @IsHexColor()
  color: string;

  @IsOptional() @IsBoolean()
  ignoresDelay?: boolean;

  @IsOptional() @IsUUID()
  groupId?: string | null;
}

export class UpdateStatusDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(60)
  name?: string;

  @IsOptional() @IsHexColor()
  color?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @IsOptional() @IsBoolean()
  ignoresDelay?: boolean;

  @IsOptional() @IsUUID()
  groupId?: string | null;
}

export class ReorderStatusDto {
  @IsIn(['PROJECT', 'JOB'])
  docType: 'PROJECT' | 'JOB';

  @IsArray() @ArrayNotEmpty() @IsUUID('all', { each: true })
  ids: string[];
}

export class CreateBriefingDto {
  @IsIn(['PROJECT', 'JOB'])
  docType: 'PROJECT' | 'JOB';

  @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  title: string;

  @IsString() @IsNotEmpty()
  html: string;
}

export class UpdateBriefingDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  title?: string;

  @IsOptional() @IsString()
  html?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class CommentDto {
  @IsString() @IsNotEmpty()
  html: string;

  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  mentionedUserIds?: string[];

  @IsOptional() @IsUUID()
  parentId?: string | null;

  @IsOptional() @IsUUID()
  fileId?: string | null;
}

export class UpdateCommentDto {
  @IsOptional() @IsString() @IsNotEmpty()
  html?: string;

  @IsOptional() @IsArray() @IsUUID('all', { each: true })
  mentionedUserIds?: string[];
}

export class PinDto {
  @IsBoolean()
  pinned: boolean;
}
