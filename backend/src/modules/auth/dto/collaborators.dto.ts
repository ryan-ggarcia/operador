import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ToBoolean, Trim } from '../../../shared/validation/query-transforms.js';

export class CollaboratorFilterDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Trim()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
}

export class CreateCollaboratorDto {
  @IsOptional()
  @IsIn(['PF', 'PJ'])
  personType?: 'PF' | 'PJ';

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  document: string;

  @IsOptional() @Trim() @IsString() @MaxLength(200)
  legalName?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  rg?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  birthDate?: Date | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @IsEmail()
  email?: string | null;

  @IsOptional() @IsObject()
  address?: Record<string, unknown> | null;

  @IsOptional() @IsUUID()
  positionId?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  admissionDate?: Date | null;

  @IsOptional() @Type(() => Date) @IsDate()
  dismissalDate?: Date | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  grossSalary?: number | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  totalCost?: number | null;

  /** Valor/hora: base do custo das horas apontadas. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  hourlyRate?: number | null;

  @IsOptional()
  benefits?: unknown;

  @IsOptional() @IsObject()
  bankData?: Record<string, unknown> | null;

  @IsOptional()
  pixKeys?: unknown;

  @IsOptional() @IsUrl()
  cvUrl?: string | null;

  @IsOptional() @IsString()
  notes?: string | null;
}

export class UpdateCollaboratorDto extends PartialType(CreateCollaboratorDto) {}

export class PositionDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class UpdatePositionDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
