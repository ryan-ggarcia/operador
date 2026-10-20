import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ALLOW_PENDING_PASSWORD_KEY } from './allow-pending-password.decorator.js';
import type { AccessTokenPayload, AuthUser } from './auth-user.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Guard global: toda rota exige o token de acesso no cabeçalho
 * Authorization, exceto as marcadas com @Public(). Com a senha provisória,
 * só as rotas marcadas com @AllowPendingPassword() respondem.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const [scheme, token] = (request.headers['authorization'] ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (
      payload.mcp &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_KEY, targets)
    ) {
      throw new ForbiddenException('Troque a senha provisória para continuar.');
    }
    request.user = { id: payload.sub, permissionsVersion: payload.pv };
    return true;
  }
}
