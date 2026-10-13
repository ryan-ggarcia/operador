import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../../shared/auth/auth-user.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import { Public } from '../../shared/auth/public.decorator.js';
import { AuthService, type SessionTokens } from './auth.service.js';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto.js';
import {
  AUTH_FACADE,
  type AuthFacade,
  type UserPermissions,
  type UserSummary,
} from './public/auth.facade.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_FACADE) private readonly users: AuthFacade,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto): Promise<SessionTokens> {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshTokenDto): Promise<SessionTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: RefreshTokenDto): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }

  @Get('me')
  async me(
    @CurrentUser() current: AuthUser,
  ): Promise<{ user: UserSummary; permissions: UserPermissions }> {
    const [user] = await this.users.getUsers([current.id]);
    const permissions = await this.users.getPermissions(current.id);
    if (!user || !permissions) throw new NotFoundException();
    return { user, permissions };
  }
}
