import { BadRequestException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../../shared/auth/auth-user.js';
import { AuthService } from './auth.service.js';
import { InMemoryLoginAttempts } from './login-attempts/in-memory-login-attempts.js';
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
  async updatePassword(userId: string, passwordHash: string) {
    const user = this.users.find((item) => item.id === userId)!;
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    for (const [hash, token] of this.tokens) {
      if (token.userId === userId) this.tokens.delete(hash);
    }
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
  async revokeUserRefreshTokens(userId: string, at: Date) {
    for (const token of this.tokens.values()) {
      if (token.userId === userId) token.revokedAt ??= at;
    }
  }
}

const plainHasher: PasswordHasher = {
  hash: async (password) => `plain:${password}`,
  verify: async (password, stored) => stored === `plain:${password}`,
};

const signed: AccessTokenPayload[] = [];
const jwt = {
  signAsync: async (payload: AccessTokenPayload) => {
    signed.push(payload);
    return 'access-token';
  },
} as unknown as JwtService;
const IP = '203.0.113.7';
const MINUTE = 60 * 1000;
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
  let now: number;

  beforeEach(() => {
    repository = new InMemoryAuthRepository();
    now = 0;
    signed.length = 0;
    service = new AuthService(
      repository,
      plainHasher,
      new InMemoryLoginAttempts(() => now),
      jwt,
      config,
    );
  });

  it('faz login com e-mail e senha certos', async () => {
    repository.users.push(makeUser());
    const session = await service.login('ana@agencia.com', 'segredo', IP);
    expect(session.accessToken).toBe('access-token');
    expect(session.refreshToken).toHaveLength(64);
    expect(session.user).toMatchObject({ id: 'u1', name: 'Ana' });
    expect(repository.logins).toEqual(['u1']);
  });

  it('recusa senha errada, e-mail inexistente e usuário inativo', async () => {
    repository.users.push(makeUser(), makeUser({ id: 'u2', email: 'off@agencia.com', active: false }));
    await expect(service.login('ana@agencia.com', 'errada', IP)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('nao@existe.com', 'segredo', IP)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('off@agencia.com', 'segredo', IP)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('o refresh token só vale uma vez (rotação)', async () => {
    repository.users.push(makeUser());
    const { refreshToken } = await service.login('ana@agencia.com', 'segredo', IP);
    const renewed = await service.refresh(refreshToken);
    expect(renewed.refreshToken).not.toBe(refreshToken);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout invalida o refresh token', async () => {
    repository.users.push(makeUser());
    const { refreshToken } = await service.login('ana@agencia.com', 'segredo', IP);
    await service.logout(refreshToken);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh de usuário desativado depois do login é recusado', async () => {
    const user = makeUser();
    repository.users.push(user);
    const { refreshToken } = await service.login('ana@agencia.com', 'segredo', IP);
    user.active = false;
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('troca a senha, encerra as sessões antigas e tira a troca obrigatória', async () => {
    repository.users.push(makeUser({ mustChangePassword: true }));
    const old = await service.login('ana@agencia.com', 'segredo', IP);
    const session = await service.changePassword('u1', 'segredo', 'nova-senha-1');
    expect(session.user.mustChangePassword).toBe(false);
    await expect(service.refresh(old.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('ana@agencia.com', 'nova-senha-1', IP)).resolves.toBeDefined();
  });

  it('recusa senha atual errada, senha curta ou igual à atual', async () => {
    repository.users.push(makeUser());
    await expect(service.changePassword('u1', 'errada', 'nova-senha-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changePassword('u1', 'segredo', 'curta')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.changePassword('u1', 'segredo', 'segredo')).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('limite de tentativas de login', () => {
    const tooMany = expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS });

    it('3 senhas erradas bloqueiam o par por 15 minutos, mesmo com a senha certa', async () => {
      repository.users.push(makeUser());
      for (let i = 0; i < 3; i++) {
        await expect(service.login('ana@agencia.com', 'errada', IP)).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(service.login(' Ana@Agencia.com ', 'segredo', IP)).rejects.toThrow('Muitas tentativas. Tente de novo em 15 minutos.');
      await expect(service.login('ana@agencia.com', 'segredo', IP)).rejects.toEqual(tooMany);
      now = 15 * MINUTE - 1;
      await expect(service.login('ana@agencia.com', 'segredo', IP)).rejects.toEqual(tooMany);
      now = 15 * MINUTE;
      await expect(service.login('ana@agencia.com', 'segredo', IP)).resolves.toBeDefined();
    });

    it('login certo antes do bloqueio zera a contagem', async () => {
      repository.users.push(makeUser());
      await expect(service.login('ana@agencia.com', 'errada', IP)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login('ana@agencia.com', 'errada', IP)).rejects.toBeInstanceOf(UnauthorizedException);
      await service.login('ana@agencia.com', 'segredo', IP);
      await expect(service.login('ana@agencia.com', 'errada', IP)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login('ana@agencia.com', 'errada', IP)).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.login('ana@agencia.com', 'segredo', IP)).resolves.toBeDefined();
    });

    it('e-mail inexistente também conta', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(service.login('nao@existe.com', 'x', IP)).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(service.login('nao@existe.com', 'x', IP)).rejects.toEqual(tooMany);
    });

    it('cada par e-mail + IP conta separado', async () => {
      repository.users.push(makeUser());
      for (let i = 0; i < 3; i++) {
        await expect(service.login('ana@agencia.com', 'errada', IP)).rejects.toBeInstanceOf(UnauthorizedException);
      }
      await expect(service.login('ana@agencia.com', 'segredo', '198.51.100.1')).resolves.toBeDefined();
      await expect(service.login('outro@agencia.com', 'x', IP)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('20 senhas erradas de IPs diferentes travam a conta (força bruta com IPs rotativos)', async () => {
      repository.users.push(makeUser());
      for (let i = 0; i < 20; i++) {
        await expect(service.login('ana@agencia.com', 'errada', `10.0.0.${i}`)).rejects.toBeInstanceOf(UnauthorizedException);
      }
      // IP novo e senha certa ainda são barrados pela trava de conta.
      await expect(service.login('ana@agencia.com', 'segredo', '10.0.1.1')).rejects.toEqual(tooMany);
    });
  });

  it('o token de acesso marca a senha provisória até a troca', async () => {
    repository.users.push(makeUser({ mustChangePassword: true }));
    const { refreshToken } = await service.login('ana@agencia.com', 'segredo', IP);
    await service.refresh(refreshToken);
    await service.changePassword('u1', 'segredo', 'nova-senha-1');
    expect(signed.map((payload) => payload.mcp)).toEqual([true, true, undefined]);
  });

  it('reuso de refresh token já rotacionado derruba todas as sessões do usuário', async () => {
    repository.users.push(makeUser());
    const first = await service.login('ana@agencia.com', 'segredo', IP);
    const other = await service.login('ana@agencia.com', 'segredo', IP);
    const renewed = await service.refresh(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(renewed.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(other.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh inexistente ou vencido só é recusado, sem derrubar as outras sessões', async () => {
    repository.users.push(makeUser());
    const valid = await service.login('ana@agencia.com', 'segredo', IP);
    const expired = await service.login('ana@agencia.com', 'segredo', IP);
    [...repository.tokens.values()].at(-1)!.expiresAt = new Date(0);
    await expect(service.refresh('nao-existe')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(expired.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(valid.refreshToken)).resolves.toBeDefined();
  });

  it('token antigo usado depois da troca de senha não derruba a sessão nova', async () => {
    repository.users.push(makeUser());
    const old = await service.login('ana@agencia.com', 'segredo', IP);
    const session = await service.changePassword('u1', 'segredo', 'nova-senha-1');
    await expect(service.refresh(old.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(session.refreshToken)).resolves.toBeDefined();
  });
});
