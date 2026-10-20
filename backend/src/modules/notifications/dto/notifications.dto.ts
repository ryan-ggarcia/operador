import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToBoolean } from '../../../shared/validation/query-transforms.js';

export class NotificationListDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MarkReadDto {
  /** Sem ids, marca todas. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids?: string[];
}

export class PreferenceDto {
  @IsString()
  event!: string;

  @IsBoolean()
  inApp!: boolean;
}

export class PreferencesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PreferenceDto)
  preferences!: PreferenceDto[];
}
