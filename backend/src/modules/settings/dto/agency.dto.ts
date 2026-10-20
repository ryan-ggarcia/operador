import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../../shared/validation/query-transforms.js';
import type { AgencyAddress } from '../public/settings.facade.js';

export class UpdateAgencyDto {
  @IsOptional() @Trim() @IsString() @MaxLength(200)
  legalName?: string;

  @IsOptional() @Trim() @IsString() @MaxLength(200)
  tradeName?: string;

  @IsOptional() @IsString() @MaxLength(20)
  cnpj?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  stateRegistration?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  municipalRegistration?: string | null;

  @IsOptional() @IsEmail()
  email?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @IsObject()
  address?: AgencyAddress | null;

  @IsOptional() @IsUUID()
  logoFileId?: string | null;

  @IsOptional() @IsString() @MaxLength(60)
  timezone?: string;
}
