import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ToBoolean } from '../../../shared/validation/query-transforms.js';

export class TemplateListDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}

export class TemplateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsUUID()
  responsibleId?: string | null;
}

export class TemplateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsUUID()
  responsibleId?: string | null;

  @IsOptional()
  @IsUUID()
  statusId?: string | null;

  @IsOptional()
  @IsString()
  briefing?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TemplateTaskDto)
  tasks!: TemplateTaskDto[];
}

export class TemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  briefing?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TemplateJobDto)
  jobs!: TemplateJobDto[];
}

export class TemplateActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class TemplateTitleDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;
}

export class ProjectFromTemplateDto extends TemplateTitleDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

export class JobDestinationDto extends TemplateTitleDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;
}

/** Job a partir de job de template: o que vier aqui troca o que está no template. */
export class JobFromTemplateDto extends JobDestinationDto {
  @IsOptional()
  @IsUUID()
  responsibleId?: string | null;

  @IsOptional()
  @IsUUID()
  statusId?: string | null;

  @IsOptional()
  @IsString()
  briefing?: string | null;

  @IsOptional()
  @IsString()
  deadline?: string | null;

  @IsOptional()
  @IsBoolean()
  deadlineHasTime?: boolean;
}

export class ApplyTemplateDto {
  @IsUUID()
  templateId!: string;
}

export class ApplyTemplateJobDto {
  @IsUUID()
  templateJobId!: string;
}

export class DuplicateProjectDto {
  @IsUUID()
  clientId!: string;
}
