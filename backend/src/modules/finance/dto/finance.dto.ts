import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['REVENUE', 'EXPENSE'] as const;
const PARTY_TYPES = ['CLIENT', 'SUPPLIER', 'PROVIDER', 'VEHICLE', 'COLLABORATOR'] as const;

export class BillListDto extends PageQuery {
  @IsOptional() @ToArray() @IsIn(KINDS, { each: true })
  kinds?: ('REVENUE' | 'EXPENSE')[];

  @IsOptional() @ToArray() @IsIn(['OPEN', 'PAID', 'CANCELED'], { each: true })
  situations?: ('OPEN' | 'PAID' | 'CANCELED')[];

  @IsOptional() @IsString() @Matches(DATE)
  from?: string;

  @IsOptional() @IsString() @Matches(DATE)
  to?: string;

  @IsOptional() @Trim() @IsString()
  search?: string;

  @IsOptional() @IsUUID()
  partyId?: string;

  @IsOptional() @IsUUID()
  clientId?: string;

  @IsOptional() @IsUUID()
  projectId?: string;

  @IsOptional() @IsUUID()
  accountId?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @ToBoolean() @IsBoolean()
  overdue?: boolean;
}

export class CreateBillDto {
  @IsIn(KINDS)
  kind: 'REVENUE' | 'EXPENSE';

  @IsIn(PARTY_TYPES)
  partyType: (typeof PARTY_TYPES)[number];

  @IsUUID()
  partyId: string;

  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  accountId: string;

  @IsUUID()
  paymentMethodId: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  additions?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  discounts?: number;

  @IsString() @Matches(DATE)
  dueDate: string;

  @IsOptional() @IsString() @Matches(DATE)
  competenceDate?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  billingDate?: string | null;

  @IsOptional() @IsIn(['SINGLE', 'INSTALLMENTS', 'RECURRING'])
  condition?: 'SINGLE' | 'INSTALLMENTS' | 'RECURRING';

  @IsOptional() @IsInt() @Min(2) @Max(120)
  count?: number;

  @IsOptional() @IsIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY'])
  frequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY';

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  documentNumber?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  referenceNumber?: string | null;

  @IsOptional() @IsUUID()
  clientId?: string | null;

  @IsOptional() @IsUUID()
  projectId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @IsString() @MaxLength(5000)
  notes?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  paidAt?: string | null;
}

export class UpdateBillDto {
  @IsOptional() @IsIn(PARTY_TYPES)
  partyType?: (typeof PARTY_TYPES)[number];

  @IsOptional() @IsUUID()
  partyId?: string;

  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsUUID()
  accountId?: string;

  @IsOptional() @IsUUID()
  paymentMethodId?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  additions?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  discounts?: number;

  @IsOptional() @IsString() @Matches(DATE)
  dueDate?: string;

  @IsOptional() @IsString() @Matches(DATE)
  competenceDate?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  billingDate?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  documentNumber?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  referenceNumber?: string | null;

  @IsOptional() @IsUUID()
  clientId?: string | null;

  @IsOptional() @IsUUID()
  projectId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @IsString() @MaxLength(5000)
  notes?: string | null;
}

export class SettleDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(200) @IsUUID('all', { each: true })
  ids: string[];

  @IsString() @Matches(DATE)
  paidAt: string;
}

export class CancelDto {
  @IsOptional() @IsIn(['this', 'next', 'all'])
  scope?: 'this' | 'next' | 'all';
}

export class PeriodDto {
  @IsString() @Matches(DATE)
  from: string;

  @IsString() @Matches(DATE)
  to: string;
}

export class OptionalPeriodDto {
  @IsOptional() @IsString() @Matches(DATE)
  from?: string;

  @IsOptional() @IsString() @Matches(DATE)
  to?: string;
}

export class TransferDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;

  @IsUUID()
  fromAccountId: string;

  @IsUUID()
  toAccountId: string;

  @IsString() @Matches(DATE)
  date: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount: number;
}

export class CategoryDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @IsIn(KINDS)
  kind: 'REVENUE' | 'EXPENSE';

  @IsOptional() @IsUUID()
  parentId?: string | null;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class AccountDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @IsOptional() @Trim() @IsString() @MaxLength(120)
  bank?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  accountType?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(20)
  agency?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(30)
  number?: string | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 })
  initialBalance?: number;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class NamedDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateNamedDto extends PartialType(NamedDto) {}
