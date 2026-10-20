import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/auth/auth-user.js';
import { CurrentUser } from '../../../shared/auth/current-user.decorator.js';
import { FULL, READ_ALL } from '../domain/permissions.js';
import {
  CollaboratorFilterDto,
  CreateCollaboratorDto,
  PositionDto,
  UpdateCollaboratorDto,
  UpdatePositionDto,
} from '../dto/collaborators.dto.js';
import { LoadAccess, RequireAccess } from '../public/access.js';
import type { CollaboratorData } from '../repositories/collaborator.repository.js';
import { CollaboratorsService } from './collaborators.service.js';

function toData(body: CreateCollaboratorDto): CollaboratorData {
  return {
    personType: body.personType ?? 'PF',
    name: body.name,
    document: body.document,
    legalName: body.legalName ?? null,
    rg: body.rg ?? null,
    birthDate: body.birthDate ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    address: body.address ?? null,
    positionId: body.positionId ?? null,
    admissionDate: body.admissionDate ?? null,
    dismissalDate: body.dismissalDate ?? null,
    grossSalary: body.grossSalary ?? null,
    totalCost: body.totalCost ?? null,
    hourlyRate: body.hourlyRate ?? null,
    benefits: body.benefits ?? null,
    bankData: body.bankData ?? null,
    pixKeys: body.pixKeys ?? null,
    cvUrl: body.cvUrl ?? null,
    notes: body.notes ?? null,
  };
}

/** Dados de RH: só com a permissão de colaboradores. */
@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly collaborators: CollaboratorsService) {}

  @Get()
  @RequireAccess('employees', READ_ALL)
  list(@Query() filter: CollaboratorFilterDto) {
    return this.collaborators.list(filter);
  }

  @Get(':id')
  @RequireAccess('employees', READ_ALL)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.collaborators.get(id);
  }

  @Post()
  @RequireAccess('employees', FULL)
  create(@Body() body: CreateCollaboratorDto, @CurrentUser() actor: AuthUser) {
    return this.collaborators.create(toData(body), actor.id);
  }

  @Patch(':id')
  @RequireAccess('employees', FULL)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCollaboratorDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.collaborators.update(id, body as Partial<CollaboratorData>, actor.id);
  }

  @Post(':id/activate')
  @RequireAccess('employees', FULL)
  @HttpCode(HttpStatus.OK)
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.collaborators.setActive(id, true, actor.id);
  }

  @Post(':id/deactivate')
  @RequireAccess('employees', FULL)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.collaborators.setActive(id, false, actor.id);
  }
}

@Controller('positions')
export class PositionsController {
  constructor(private readonly collaborators: CollaboratorsService) {}

  @Get()
  @LoadAccess()
  list() {
    return this.collaborators.listPositions();
  }

  @Post()
  @RequireAccess('employees', FULL)
  create(@Body() body: PositionDto) {
    return this.collaborators.createPosition(body.name);
  }

  @Patch(':id')
  @RequireAccess('employees', FULL)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePositionDto) {
    return this.collaborators.updatePosition(id, body);
  }
}
