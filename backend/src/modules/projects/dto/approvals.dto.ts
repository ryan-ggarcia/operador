import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DOC_TYPES = ['PROJECT', 'JOB'] as const;

export class ApprovalListDto {
  @IsIn(DOC_TYPES)
  docType!: (typeof DOC_TYPES)[number];

  @IsUUID()
  docId!: string;
}

export class ApprovalRequestDto extends ApprovalListDto {
  @IsUUID()
  fileId!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  approverIds!: string[];

  @IsOptional()
  @IsString()
  deadline?: string | null;
}

export class ApprovalVoteDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}

export class ApprovalMarkerDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;

  @IsString()
  @MaxLength(2000)
  text!: string;
}
