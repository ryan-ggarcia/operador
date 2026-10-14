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
  AccessProfileDto,
  CreateUserDto,
  ResetPasswordDto,
  TeamDto,
  UpdateAccessProfileDto,
  UpdateTeamDto,
  UpdateUserDto,
  UserFilterDto,
} from '../dto/users.dto.js';
import { LoadAccess, RequireAdministrator } from '../public/access.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Usuários ativos para seletores; qualquer usuário logado. */
  @Get('options')
  @LoadAccess()
  options() {
    return this.users.options();
  }

  @Get()
  @RequireAdministrator()
  list(@Query() filter: UserFilterDto) {
    return this.users.list(filter);
  }

  @Get(':id')
  @RequireAdministrator()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post()
  @RequireAdministrator()
  create(@Body() body: CreateUserDto) {
    return this.users.create(body);
  }

  @Patch(':id')
  @RequireAdministrator()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateUserDto) {
    return this.users.update(id, body);
  }

  @Post(':id/activate')
  @RequireAdministrator()
  @HttpCode(HttpStatus.OK)
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.setActive(id, true, actor.id);
  }

  @Post(':id/deactivate')
  @RequireAdministrator()
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.users.setActive(id, false, actor.id);
  }

  /** Senha provisória definida pelo administrador (sem e-mail na v1). */
  @Post(':id/password')
  @RequireAdministrator()
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() body: ResetPasswordDto) {
    return this.users.resetPassword(id, body.temporaryPassword);
  }
}

@Controller('access-profiles')
@RequireAdministrator()
export class AccessProfilesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.listProfiles();
  }

  @Post()
  create(@Body() body: AccessProfileDto) {
    return this.users.createProfile(body.name, body.permissions);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAccessProfileDto) {
    return this.users.updateProfile(id, body);
  }
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly users: UsersService) {}

  /** Equipes servem de filtro nas pautas; qualquer usuário logado. */
  @Get()
  @LoadAccess()
  list() {
    return this.users.listTeams();
  }

  @Post()
  @RequireAdministrator()
  create(@Body() body: TeamDto) {
    return this.users.createTeam(body.name, body.userIds);
  }

  @Patch(':id')
  @RequireAdministrator()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateTeamDto) {
    return this.users.updateTeam(id, body);
  }
}
