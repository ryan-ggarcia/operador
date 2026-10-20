import {
  applyDecorators,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../../../shared/auth/auth-user.js';
import {
  hasLevel,
  type AccessLevel,
  type PermissionModule,
  type UserPermissions,
} from '../domain/permissions.js';
import { AUTH_FACADE, type AuthFacade } from './auth.facade.js';

export {
  ADMIN,
  canEditOwn,
  FULL,
  hasLevel,
  READ_ALL,
} from '../domain/permissions.js';

/** Exigência de acesso de uma rota: nível mínimo em um dos módulos. */
export type AccessRequirement =
  | { kind: 'module'; modules: PermissionModule[]; minimum: AccessLevel }
  | { kind: 'administrator' };

const ACCESS_KEY = 'operador:access';

interface RequestWithAccess {
  user?: AuthUser;
  access?: UserPermissions;
}

/**
 * Carrega as permissões do usuário autenticado, confere a exigência da rota
 * e deixa as permissões em request.access (ver @CurrentAccess).
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      AccessRequirement | undefined
    >(ACCESS_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<RequestWithAccess>();
    if (!request.user) throw new UnauthorizedException();

    const permissions = await this.auth.getPermissions(request.user.id);
    // Usuário desativado depois do login perde o acesso na hora.
    if (!permissions) throw new UnauthorizedException();
    request.access = permissions;

    if (!requirement || meetsRequirement(permissions, requirement)) return true;
    throw new ForbiddenException('Sem permissão para esta ação.');
  }
}

export function meetsRequirement(
  permissions: UserPermissions,
  requirement: AccessRequirement,
): boolean {
  if (requirement.kind === 'administrator') {
    return permissions.flags.administrator;
  }
  return requirement.modules.some((module) =>
    hasLevel(permissions, module, requirement.minimum),
  );
}

/**
 * A rota exige nível mínimo em pelo menos um dos módulos. Sem nível, basta
 * ter acesso (nível 1 ou mais).
 */
export function RequireAccess(
  module: PermissionModule | PermissionModule[],
  minimum: AccessLevel = 1,
) {
  const modules = Array.isArray(module) ? module : [module];
  return applyDecorators(
    SetMetadata(ACCESS_KEY, { kind: 'module', modules, minimum }),
    UseGuards(AccessGuard),
  );
}

/** A rota é só para administradores da conta. */
export function RequireAdministrator() {
  return applyDecorators(
    SetMetadata(ACCESS_KEY, { kind: 'administrator' }),
    UseGuards(AccessGuard),
  );
}

/** Só carrega as permissões, sem exigência (a regra fica no service). */
export function LoadAccess() {
  return UseGuards(AccessGuard);
}

/**
 * Injeta as permissões do usuário. A rota (ou o controller) precisa de
 * @RequireAccess, @RequireAdministrator ou @LoadAccess.
 */
export const CurrentAccess = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserPermissions => {
    const access = context.switchToHttp().getRequest<RequestWithAccess>().access;
    if (!access) throw new UnauthorizedException();
    return access;
  },
);
