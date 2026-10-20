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
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PageQuery } from '../../../shared/validation/pagination.js';
import { ToArray, ToBoolean, Trim } from '../../../shared/validation/query-transforms.js';
import { BILLING_TYPES, type BillingType } from '../../finance/public/billing.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALUE_TYPES = ['PERCENT', 'AMOUNT'] as const;

export class ProductionListDto extends PageQuery {
  @IsOptional() @Trim() @IsString()
  search?: string;

  @IsOptional() @ToArray() @IsIn(['OPEN', 'DONE', 'CANCELED'], { each: true })
  situations?: ('OPEN' | 'DONE' | 'CANCELED')[];

  @IsOptional() @IsUUID()
  clientId?: string;

  @IsOptional() @IsUUID()
  projectId?: string;

  @IsOptional() @IsUUID()
  supplierId?: string;

  @IsOptional() @ToBoolean() @IsBoolean()
  mine?: boolean;
}

export class CreateProductionDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;

  @IsUUID()
  clientId: string;

  @IsOptional() @IsUUID()
  projectId?: string | null;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  deadline?: string | null;

  @IsOptional() @IsString()
  briefing?: string | null;
}

export class UpdateProductionDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title?: string;

  @IsOptional() @IsUUID()
  clientContactId?: string | null;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  deadline?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(3650)
  validityDays?: number | null;

  @IsOptional() @IsUUID()
  taxId?: string | null;

  @IsOptional() @IsString() @MaxLength(5000)
  paymentConditions?: string | null;

  @IsOptional() @IsString() @MaxLength(5000)
  clientNotes?: string | null;

  @IsOptional() @IsString()
  briefing?: string | null;
}

export class MembersDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @IsUUID('all', { each: true })
  userIds: string[];
}

export class ItemDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsNumber({ maxDecimalPlaces: 4 }, { each: true }) @IsPositive({ each: true })
  quantities?: number[];

  @IsOptional() @IsIn(VALUE_TYPES)
  commissionType?: 'PERCENT' | 'AMOUNT';

  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  commissionValue?: number;

  @IsOptional() @IsIn(VALUE_TYPES)
  feeType?: 'PERCENT' | 'AMOUNT';

  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  feeValue?: number;
}

export class ItemSupplierDto {
  @IsUUID()
  supplierId: string;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  estimateNumber?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  dueDate?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(99)
  orderGroup?: number;
}

export class UpdateItemSupplierDto {
  @IsOptional() @Trim() @IsString() @MaxLength(60)
  estimateNumber?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  dueDate?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(99)
  orderGroup?: number;
}

export class QuoteDto {
  @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive()
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0)
  unitValue: number;
}

export class ApproveDto {
  /** Quantidade aprovada; null desaprova. */
  @ValidateIf((_, value) => value !== null) @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive()
  quantity: number | null;
}

export class OrderDto {
  @IsOptional() @IsIn(Object.keys(BILLING_TYPES))
  billingType?: BillingType | null;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  discount?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  negotiatedCommission?: number | null;

  @IsOptional() @IsString() @MaxLength(5000)
  supplierNotes?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(500)
  deliveryPlace?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  deliveryDate?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  firstDueDate?: string | null;
}

export class TaxDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120)
  title: string;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  type?: string | null;

  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(100)
  percent: number;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

const TEXT_KINDS = ['PAYMENT_CONDITION', 'CLIENT_NOTE', 'SUPPLIER_NOTE', 'BRIEFING'] as const;

export class TextListDto {
  @IsOptional() @IsIn(TEXT_KINDS)
  kind?: (typeof TEXT_KINDS)[number];
}

export class TextDto {
  @IsIn(TEXT_KINDS)
  kind: (typeof TEXT_KINDS)[number];

  @Trim() @IsString() @IsNotEmpty() @MaxLength(150)
  title: string;

  @IsString() @IsNotEmpty()
  html: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class StatusListDto {
  @IsOptional() @ToBoolean() @IsBoolean()
  includeInactive?: boolean;
}
