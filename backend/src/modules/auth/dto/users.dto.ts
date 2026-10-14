import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsHexColor,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ToBoolean, Trim } from '../../../shared/validation/query-transforms.js';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword: string;
}

export class UserFilterDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  search?: string;
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  collaboratorId?: string;

  @IsUUID()
  accessProfileId: string;

  @IsOptional()
  @IsObject()
  customPermissions?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  teamIds?: string[];

  @IsOptional()
  @IsHexColor()
  color?: string | null;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  temporaryPassword: string;
}

export class UpdateUserDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string | null;

  @IsOptional()
  @IsUUID()
  accessProfileId?: string;

  /** Objeto de permissões, ou null para voltar a usar o perfil. */
  @IsOptional()
  @IsObject()
  customPermissions?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  teamIds?: string[];
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  temporaryPassword: string;
}

export class AccessProfileDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsObject()
  permissions: Record<string, unknown>;
}

export class UpdateAccessProfileDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;
}

export class TeamDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  userIds?: string[];
}

export class UpdateTeamDto {
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  userIds?: string[];
}
