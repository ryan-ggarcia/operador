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
import {
  CurrentAccess,
  LoadAccess,
  RequireAdministrator,
  type UserPermissions,
} from '../../auth/public/index.js';
import { CatalogService } from '../catalog/catalog.service.js';
import {
  CatalogItemDto,
  ContactListDto,
  CreateContactDto,
  CreatePartyDto,
  NoteDto,
  PartyListDto,
  PartyOptionsDto,
  UpdateCatalogItemDto,
  UpdateContactDto,
  UpdatePartyDto,
} from '../dto/crm.dto.js';
import type { ContactData } from '../repositories/contact.repository.js';
import type { PartyData } from '../repositories/party.repository.js';
import { PartiesService } from './parties.service.js';

function toPartyData(body: CreatePartyDto): PartyData {
  return {
    personType: body.personType ?? 'PJ',
    name: body.name,
    legalName: body.legalName ?? null,
    document: body.document ?? null,
    stateRegistration: body.stateRegistration ?? null,
    municipalRegistration: body.municipalRegistration ?? null,
    email: body.email ?? null,
    phone1: body.phone1 ?? null,
    phone2: body.phone2 ?? null,
    website: body.website ?? null,
    zipCode: body.zipCode ?? null,
    street: body.street ?? null,
    number: body.number ?? null,
    complement: body.complement ?? null,
    district: body.district ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    country: body.country ?? 'Brasil',
    isClient: body.isClient ?? false,
    isSupplier: body.isSupplier ?? false,
    isProvider: body.isProvider ?? false,
    isVehicle: body.isVehicle ?? false,
    clientGroupId: body.clientGroupId ?? null,
    bankData: body.bankData ?? null,
    notes: body.notes ?? null,
  };
}

function toContactData(body: CreateContactDto): ContactData {
  return {
    name: body.name,
    email: body.email ?? null,
    departmentId: body.departmentId ?? null,
    phone1: body.phone1 ?? null,
    phone2: body.phone2 ?? null,
    birthDate: body.birthDate ?? null,
  };
}

/** Clientes, fornecedores, prestadores e veículos (cadastro único). */
@Controller('parties')
@LoadAccess()
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Get()
  list(@CurrentAccess() access: UserPermissions, @Query() query: PartyListDto) {
    return this.parties.list(access, query);
  }

  /** Nomes para seletores; qualquer usuário logado. */
  @Get('options')
  options(@Query() query: PartyOptionsDto) {
    return this.parties.options(query.role, query.search);
  }

  @Get(':id')
  get(@CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.get(access, id);
  }

  @Post()
  @RequireAdministrator()
  create(
    @CurrentAccess() access: UserPermissions,
    @CurrentUser() user: AuthUser,
    @Body() body: CreatePartyDto,
  ) {
    return this.parties.create(access, toPartyData(body), user.id);
  }

  @Patch(':id')
  @RequireAdministrator()
  update(
    @CurrentAccess() access: UserPermissions,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePartyDto,
  ) {
    return this.parties.update(access, id, body as Partial<PartyData>, user.id);
  }

  @Post(':id/activate')
  @RequireAdministrator()
  @HttpCode(HttpStatus.OK)
  activate(
    @CurrentAccess() access: UserPermissions,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parties.setActive(access, id, true, user.id);
  }

  @Post(':id/deactivate')
  @RequireAdministrator()
  @HttpCode(HttpStatus.OK)
  deactivate(
    @CurrentAccess() access: UserPermissions,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parties.setActive(access, id, false, user.id);
  }

  @Get(':id/contacts')
  contacts(
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ContactListDto,
  ) {
    return this.parties.listContacts(access, id, query.includeInactive ?? false);
  }

  @Post(':id/contacts')
  @RequireAdministrator()
  createContact(
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateContactDto,
  ) {
    return this.parties.createContact(access, id, toContactData(body));
  }

  @Get(':id/notes')
  notes(@CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.parties.listNotes(access, id);
  }

  @Post(':id/notes')
  @RequireAdministrator()
  addNote(
    @CurrentAccess() access: UserPermissions,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NoteDto,
  ) {
    return this.parties.addNote(access, id, body.html, user.id);
  }
}

@Controller('contacts')
@LoadAccess()
export class ContactsController {
  constructor(private readonly parties: PartiesService) {}

  @Patch(':id')
  @RequireAdministrator()
  update(
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateContactDto,
  ) {
    return this.parties.updateContact(access, id, body);
  }
}

@Controller('party-notes')
@LoadAccess()
export class PartyNotesController {
  constructor(private readonly parties: PartiesService) {}

  @Patch(':id')
  @RequireAdministrator()
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NoteDto,
  ) {
    return this.parties.updateNote(id, body.html, user.id);
  }
}

@Controller('client-groups')
export class ClientGroupsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @LoadAccess()
  list() {
    return this.catalog.list('clientGroup');
  }

  @Post()
  @RequireAdministrator()
  create(@Body() body: CatalogItemDto) {
    return this.catalog.create('clientGroup', body.name);
  }

  @Patch(':id')
  @RequireAdministrator()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCatalogItemDto) {
    return this.catalog.update('clientGroup', id, body);
  }
}

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @LoadAccess()
  list() {
    return this.catalog.list('department');
  }

  @Post()
  @RequireAdministrator()
  create(@Body() body: CatalogItemDto) {
    return this.catalog.create('department', body.name);
  }

  @Patch(':id')
  @RequireAdministrator()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCatalogItemDto) {
    return this.catalog.update('department', id, body);
  }
}
