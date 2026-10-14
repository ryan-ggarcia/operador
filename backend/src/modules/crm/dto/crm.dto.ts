import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { PageQuery } from '../../../shared/validation/pagination.js';
import { ToBoolean, Trim } from '../../../shared/validation/query-transforms.js';
import type { PartyRole } from '../public/crm.facade.js';

const ROLES: PartyRole[] = ['client', 'supplier', 'provider', 'vehicle'];

export class PartyListDto extends PageQuery {
  @IsOptional()
  @IsIn(ROLES)
  role?: PartyRole;

  @IsOptional()
  @Trim()
  @IsString()
  search?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  clientGroupId?: string;
}

export class PartyOptionsDto {
  @IsIn(ROLES)
  role: PartyRole;

  @IsOptional()
  @Trim()
  @IsString()
  search?: string;
}

export class CreatePartyDto {
  @IsOptional() @IsIn(['PF', 'PJ'])
  personType?: 'PF' | 'PJ';

  /** Nome fantasia. */
  @Trim() @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsOptional() @Trim() @IsString() @MaxLength(200)
  legalName?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  document?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  stateRegistration?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  municipalRegistration?: string | null;

  @IsOptional() @IsEmail()
  email?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  phone1?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  phone2?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(200)
  website?: string | null;

  @IsOptional() @IsString() @MaxLength(10)
  zipCode?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(200)
  street?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(20)
  number?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(100)
  complement?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(100)
  district?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(100)
  city?: string | null;

  @IsOptional() @Trim() @IsString() @Length(2, 2)
  state?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  country?: string | null;

  @IsOptional() @IsBoolean()
  isClient?: boolean;

  @IsOptional() @IsBoolean()
  isSupplier?: boolean;

  @IsOptional() @IsBoolean()
  isProvider?: boolean;

  @IsOptional() @IsBoolean()
  isVehicle?: boolean;

  @IsOptional() @IsUUID()
  clientGroupId?: string | null;

  @IsOptional() @IsObject()
  bankData?: Record<string, unknown> | null;

  @IsOptional() @IsString()
  notes?: string | null;
}

export class UpdatePartyDto extends PartialType(CreatePartyDto) {}

export class ContactListDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateContactDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(200)
  name: string;

  @IsOptional() @IsEmail()
  email?: string | null;

  @IsOptional() @IsUUID()
  departmentId?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  phone1?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  phone2?: string | null;

  @IsOptional() @Type(() => Date) @IsDate()
  birthDate?: Date | null;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {
  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class NoteDto {
  @IsString()
  @IsNotEmpty()
  html: string;
}

export class CatalogItemDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  name: string;
}

export class UpdateCatalogItemDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(100)
  name?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}
