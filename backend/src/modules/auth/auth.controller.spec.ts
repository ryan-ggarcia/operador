import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard.js';
import { AuthController } from './auth.controller.js';

class OtherController {
  list() {}
}

const jwt = new JwtService({ secret: 'segredo-de-teste' });
const guard = new JwtAuthGuard(jwt, new Reflector());

async function canCall(
  controller: object,
  handler: (...args: never[]) => unknown,
  payload: object,
) {
  const token = await jwt.signAsync({ sub: 'u1', pv: 1, ...payload });
  const request = { headers: { authorization: `Bearer ${token}` } };
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context);
}

const { prototype: auth } = AuthController;

describe('senha provisória no guard de JWT', () => {
  it('recusa as outras rotas com 403 enquanto a senha não for trocada', async () => {
    const result = canCall(OtherController, OtherController.prototype.list, { mcp: true });
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toThrow('Troque a senha provisória para continuar.');
    await expect(canCall(AuthController, auth.refresh, {})).resolves.toBe(true);
  });

  it('libera troca de senha, /auth/me e as rotas públicas (logout)', async () => {
    for (const handler of [auth.changePassword, auth.me, auth.logout, auth.login]) {
      await expect(canCall(AuthController, handler, { mcp: true })).resolves.toBe(true);
    }
  });

  it('sem a marca, as rotas respondem normalmente', async () => {
    await expect(canCall(OtherController, OtherController.prototype.list, {})).resolves.toBe(true);
  });
});
