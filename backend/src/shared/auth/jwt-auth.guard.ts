import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthUser } from './auth-user.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Guard global: toda rota exige o token de acesso no cabeçalho
 * Authorization, exceto as marcadas com @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const [scheme, token] = (request.headers['authorization'] ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    try {
      const payload =
        await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = { id: payload.sub, permissionsVersion: payload.pv };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
