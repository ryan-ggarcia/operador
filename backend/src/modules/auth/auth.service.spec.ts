import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import type { PasswordHasher } from './password/password-hasher.js';
import type {
  AuthRepository,
  StoredRefreshToken,
  UserCredentials,
} from './repositories/auth.repository.js';

class InMemoryAuthRepository implements AuthRepository {
  users: UserCredentials[] = [];
  tokens = new Map<string, StoredRefreshToken & { tokenHash: string }>();
  logins: string[] = [];

  async findCredentialsByEmail(email: string) {
    return this.users.find((user) => user.email === email) ?? null;
  }
  async findCredentialsById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }
  async findUsersWithPermissions() {
    return [];
  }
  async findHourlyRate() {
    return null;
  }
  async markLogin(userId: string) {
    this.logins.push(userId);
  }
  async saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    const id = `t${this.tokens.size + 1}`;
    this.tokens.set(tokenHash, { id, userId, tokenHash, expiresAt, revokedAt: null });
  }
  async findRefreshToken(tokenHash: string) {
    return this.tokens.get(tokenHash) ?? null;
  }
  async revokeRefreshToken(id: string, at: Date) {
    for (const token of this.tokens.values()) {
      if (token.id === id) token.revokedAt = at;
    }
  }
}

const plainHasher: PasswordHasher = {
  hash: async (password) => `plain:${password}`,
  verify: async (password, stored) => stored === `plain:${password}`,
};

const jwt = { signAsync: async () => 'access-token' } as unknown as JwtService;
const config = { get: () => 30 } as unknown as ConfigService;

function makeUser(overrides: Partial<UserCredentials> = {}): UserCredentials {
  return {
    id: 'u1',
    email: 'ana@agencia.com',
    name: 'Ana',
    passwordHash: 'plain:segredo',
    active: true,
    mustChangePassword: false,
    permissionsVersion: 1,
    ...overrides,
  };
}

describe('AuthService', () => {
  let repository: InMemoryAuthRepository;
  let service: AuthService;

  beforeEach(() => {
    repository = new InMemoryAuthRepository();
    service = new AuthService(repository, plainHasher, jwt, config);
  });

  it('faz login com e-mail e senha certos', async () => {
    repository.users.push(makeUser());
    const session = await service.login('ana@agencia.com', 'segredo');
    expect(session.accessToken).toBe('access-token');
    expect(session.refreshToken).toHaveLength(64);
    expect(session.user).toMatchObject({ id: 'u1', name: 'Ana' });
    expect(repository.logins).toEqual(['u1']);
  });

  it('recusa senha errada, e-mail inexistente e usuário inativo', async () => {
    repository.users.push(makeUser(), makeUser({ id: 'u2', email: 'off@agencia.com', active: false }));
    await expect(service.login('ana@agencia.com', 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('nao@existe.com', 'segredo')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('off@agencia.com', 'segredo')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('o refresh token só vale uma vez (rotação)', async () => {
    repository.users.push(makeUser());
    const { refreshToken } = await service.login('ana@agencia.com', 'segredo');
    const renewed = await service.refresh(refreshToken);
    expect(renewed.refreshToken).not.toBe(refreshToken);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout invalida o refresh token', async () => {
    repository.users.push(makeUser());
    const { refreshToken } = await service.login('ana@agencia.com', 'segredo');
    await service.logout(refreshToken);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh de usuário desativado depois do login é recusado', async () => {
    const user = makeUser();
    repository.users.push(user);
    const { refreshToken } = await service.login('ana@agencia.com', 'segredo');
    user.active = false;
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
