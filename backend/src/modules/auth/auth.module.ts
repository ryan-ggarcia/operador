import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthFacadeService } from './auth.facade.service.js';
import { AuthService } from './auth.service.js';
import { PASSWORD_HASHER } from './password/password-hasher.js';
import { ScryptPasswordHasher } from './password/scrypt-password-hasher.js';
import { AUTH_FACADE } from './public/auth.facade.js';
import { AUTH_REPOSITORY } from './repositories/auth.repository.js';
import { PrismaAuthRepository } from './repositories/prisma-auth.repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: AUTH_FACADE, useClass: AuthFacadeService },
  ],
  exports: [AUTH_FACADE],
})
export class AuthModule {}
