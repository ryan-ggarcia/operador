import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ToBoolean } from '../../../shared/validation/query-transforms.js';

export class OwnerDto {
  @Matches(/^[a-z][a-z-]{1,39}$/, { message: 'Tipo de documento inválido.' })
  ownerType!: string;

  @IsUUID()
  ownerId!: string;
}

export class DescribeFileDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class DownloadQueryDto {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  inline?: boolean;
}
