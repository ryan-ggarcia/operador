import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class TaskDependenciesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  dependsOnIds!: string[];
}

export class RecurrenceDto {
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  frequency!: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  interval!: number;

  @IsOptional()
  @IsBoolean()
  businessDaysOnly?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  weekdays?: number[];

  @IsOptional()
  @IsIn(['SAME_DAY', 'LAST_DAY'])
  monthlyMode?: 'SAME_DAY' | 'LAST_DAY';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  count?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data final inválida.' })
  until?: string;
}

export class PostponeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  jobIds!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  amount!: number;

  @IsIn(['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'])
  unit!: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

  @IsIn(['JOB', 'TASKS', 'BOTH'])
  target!: 'JOB' | 'TASKS' | 'BOTH';

  @IsOptional()
  @IsBoolean()
  businessDaysOnly?: boolean;
}
