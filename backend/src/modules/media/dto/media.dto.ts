import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQuery } from '../../../shared/validation/pagination.js';
import { ToArray, ToBoolean, Trim } from '../../../shared/validation/query-transforms.js';
import { BILLING_TYPES, type BillingType } from '../domain/media-math.js';
import type { MediaSituation, MediaType } from '../repositories/media.repository.js';

const MEDIA_TYPES: MediaType[] = ['TV', 'RADIO', 'NEWSPAPER', 'MAGAZINE', 'OOH', 'INTERNET', 'OTHER'];
const SITUATIONS: MediaSituation[] = ['OPEN', 'DONE', 'CANCELED'];
const VALUE_TYPES = ['PERCENT', 'AMOUNT'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class MediaListDto extends PageQuery {
  @IsOptional() @Trim() @IsString()
  search?: string;

  @IsOptional() @ToArray() @IsIn(MEDIA_TYPES, { each: true })
  mediaTypes?: MediaType[];

  @IsOptional() @ToArray() @IsIn(SITUATIONS, { each: true })
  situations?: MediaSituation[];

  @IsOptional() @IsUUID()
  clientId?: string;

  @IsOptional() @IsUUID()
  vehicleId?: string;

  @IsOptional() @IsUUID()
  projectId?: string;

  @IsOptional() @ToArray() @IsUUID('all', { each: true })
  statusIds?: string[];

  @IsOptional() @ToBoolean() @IsBoolean()
  mine?: boolean;
}

export class CreateMediaDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;

  @IsUUID()
  clientId: string;

  @IsOptional() @IsUUID()
  projectId?: string | null;

  @IsIn(MEDIA_TYPES)
  mediaType: MediaType;

  @IsOptional() @IsUUID()
  vehicleId?: string | null;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  deadline?: string | null;

  @IsOptional() @IsString()
  briefing?: string | null;
}

export class UpdateMediaDto {
  @IsOptional() @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title?: string;

  @IsOptional() @IsUUID()
  vehicleId?: string | null;

  @IsOptional() @IsUUID()
  vehicleContactId?: string | null;

  @IsOptional() @IsUUID()
  networkId?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(100)
  channel?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(250)
  target?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(60)
  estimateNumber?: string | null;

  @IsOptional() @IsUUID()
  responsibleId?: string | null;

  @IsOptional() @IsUUID()
  statusId?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  deadline?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  documentDate?: string | null;

  @IsOptional() @IsIn(VALUE_TYPES)
  commissionType?: 'PERCENT' | 'AMOUNT';

  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  commissionValue?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  negotiatedCommission?: number | null;

  @IsOptional() @IsIn(VALUE_TYPES)
  feeType?: 'PERCENT' | 'AMOUNT';

  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  feeValue?: number;

  /** Desconto geral da mídia. */
  @IsOptional() @IsIn(VALUE_TYPES)
  discountType?: 'PERCENT' | 'AMOUNT';

  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  discountValue?: number;

  @IsOptional() @IsIn(Object.keys(BILLING_TYPES))
  billingType?: BillingType | null;

  @IsOptional() @IsString() @Matches(DATE)
  firstDueDate?: string | null;

  @IsOptional() @Trim() @IsString() @MaxLength(250)
  paymentCondition?: string | null;

  @IsOptional() @IsString()
  vehicleNotes?: string | null;

  @IsOptional() @IsString()
  clientNotes?: string | null;

  @IsOptional() @IsString()
  briefing?: string | null;

  /** Confirma apagar as grades ao trocar o veículo (ou o canal, na TV). */
  @IsOptional() @IsBoolean()
  confirmClearGrids?: boolean;
}

export class MembersDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @IsUUID('all', { each: true })
  userIds: string[];
}

export class PieceDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  title: string;
}

export class GridDto {
  @IsOptional() @IsUUID()
  marketId?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  periodStart?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  periodEnd?: string | null;
}

export class LineDto {
  @IsOptional() @IsUUID()
  pieceId?: string | null;

  @IsOptional() @IsUUID()
  programId?: string | null;

  @IsOptional() @IsString() @MaxLength(250)
  product?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  location?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  section?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  position?: string | null;

  @IsOptional() @IsString() @MaxLength(60)
  color?: string | null;

  @IsOptional() @IsString() @MaxLength(250)
  format?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  placementType?: string | null;

  @IsOptional() @IsUUID()
  costMetricId?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  startDate?: string | null;

  @IsOptional() @IsString() @Matches(DATE)
  endDate?: string | null;

  /** Externa: bi-semanas do ano (1 a 26). */
  @IsOptional() @IsArray() @IsInt({ each: true })
  biweeks?: number[] | null;

  /** TV e rádio: AAAA-MM-DD → inserções no dia. */
  @IsOptional() @IsObject()
  dailyInsertions?: Record<string, number> | null;

  @IsOptional() @IsInt() @Min(0) @Max(10_000_000)
  insertions?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  unitValue?: number;

  @IsOptional() @IsIn(VALUE_TYPES)
  discountType?: 'PERCENT' | 'AMOUNT';

  @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  discountValue?: number;

  @IsOptional() @IsBoolean()
  isBonus?: boolean;
}

export class NetworkDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  name: string;

  @Trim() @IsString() @IsNotEmpty() @MaxLength(10)
  mnemonic: string;

  @IsIn(['OPEN_TV', 'PAY_TV', 'RADIO', 'OTHER'])
  type: 'OPEN_TV' | 'PAY_TV' | 'RADIO' | 'OTHER';

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class MarketDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @IsOptional() @Trim() @IsString() @MaxLength(20)
  abbreviation?: string | null;

  @IsOptional() @IsString() @Length(2, 2)
  state?: string | null;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class ProgramDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(250)
  name: string;

  @Trim() @IsString() @IsNotEmpty() @MaxLength(20)
  mnemonic: string;

  @IsUUID()
  networkId: string;

  @IsOptional() @Trim() @IsString() @MaxLength(100)
  channel?: string | null;

  @IsIn(['TV', 'RADIO'])
  mediaType: 'TV' | 'RADIO';

  @IsArray() @ArrayNotEmpty() @IsInt({ each: true })
  airingDays: number[];

  @IsOptional() @IsString() @Matches(TIME)
  startTime?: string | null;

  @IsOptional() @IsString() @Matches(TIME)
  endTime?: string | null;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class ProgramListDto {
  @IsOptional() @IsUUID()
  networkId?: string;

  @IsOptional() @IsIn(['TV', 'RADIO'])
  mediaType?: 'TV' | 'RADIO';
}

export class NamedDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(60)
  name: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class MediaStatusDto {
  @Trim() @IsString() @IsNotEmpty() @MaxLength(60)
  name: string;

  @IsHexColor()
  color: string;

  @IsOptional() @IsBoolean()
  ignoresDelay?: boolean;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class StatusListDto {
  @IsOptional() @ToBoolean() @IsBoolean()
  includeInactive?: boolean;
}
