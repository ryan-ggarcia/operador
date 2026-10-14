import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthFacadeService } from './auth.facade.service.js';
import { AuthService } from './auth.service.js';
import { CollaboratorsController, PositionsController } from './collaborators/collaborators.controller.js';
import { CollaboratorsService } from './collaborators/collaborators.service.js';
import {
  PERMISSIONS_CACHE,
  PERMISSIONS_CACHE_TTL_MS,
} from './domain/permissions-cache.js';
import { TtlCache } from './domain/ttl-cache.js';
import { PASSWORD_HASHER } from './password/password-hasher.js';
import { ScryptPasswordHasher } from './password/scrypt-password-hasher.js';
import { AccessGuard } from './public/access.js';
import { AUTH_FACADE } from './public/auth.facade.js';
import { AUTH_REPOSITORY } from './repositories/auth.repository.js';
import { COLLABORATOR_REPOSITORY } from './repositories/collaborator.repository.js';
import { PrismaAuthRepository } from './repositories/prisma-auth.repository.js';
import { PrismaCollaboratorRepository } from './repositories/prisma-collaborator.repository.js';
import { PrismaUserAdminRepository } from './repositories/prisma-user-admin.repository.js';
import { USER_ADMIN_REPOSITORY } from './repositories/user-admin.repository.js';
import {
  AccessProfilesController,
  TeamsController,
  UsersController,
} from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

@Module({
  controllers: [
    AuthController,
    UsersController,
    AccessProfilesController,
    TeamsController,
    CollaboratorsController,
    PositionsController,
  ],
  providers: [
    AuthService,
    UsersService,
    CollaboratorsService,
    AccessGuard,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: USER_ADMIN_REPOSITORY, useClass: PrismaUserAdminRepository },
    { provide: COLLABORATOR_REPOSITORY, useClass: PrismaCollaboratorRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    {
      provide: PERMISSIONS_CACHE,
      useFactory: () => new TtlCache(PERMISSIONS_CACHE_TTL_MS),
    },
    { provide: AUTH_FACADE, useClass: AuthFacadeService },
  ],
  exports: [AUTH_FACADE],
})
export class AuthModule {}
