import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { AccessTokenPayload } from '../../shared/auth/auth-user.js';
import {
  LOGIN_ATTEMPTS,
  type LoginAttempts,
} from './login-attempts/login-attempts.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from './password/password-hasher.js';
import {
  AUTH_REPOSITORY,
  type AuthRepository,
  type UserCredentials,
} from './repositories/auth.repository.js';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    mustChangePassword: boolean;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
/** Senhas erradas seguidas (por e-mail + IP) antes do bloqueio. */
const MAX_LOGIN_FAILURES = 3;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Login com e-mail e senha, token de acesso curto e refresh token rotativo. */
@Injectable()
export class AuthService {
  private readonly refreshTokenDays: number;

  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(LOGIN_ATTEMPTS) private readonly attempts: LoginAttempts,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.refreshTokenDays = Number(config.get('REFRESH_TOKEN_DAYS', 30));
  }

  /**
   * Cada tentativa conta para o par e-mail + IP (inclusive e-mail que não
   * existe, para não revelar quais existem); login certo zera. Passando de
   * MAX_LOGIN_FAILURES, o par fica bloqueado, mesmo com a senha certa.
   */
  async login(email: string, password: string, ip: string): Promise<SessionTokens> {
    const normalized = email.trim().toLowerCase();
    const key = `${ip}|${normalized}`;
    if (!(await this.attempts.take(key, MAX_LOGIN_FAILURES, LOGIN_LOCK_MS))) {
      throw new HttpException(
        'Muitas tentativas. Tente de novo em 15 minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.repository.findCredentialsByEmail(normalized);
    // Mesma resposta para e-mail inexistente, senha errada e usuário inativo.
    if (!user || !user.active) throw new UnauthorizedException();
    if (!(await this.hasher.verify(password, user.passwordHash))) {
      throw new UnauthorizedException();
    }
    await this.attempts.reset(key);
    await this.repository.markLogin(user.id, new Date());
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const stored = await this.repository.findRefreshToken(
      hashToken(refreshToken),
    );
    const now = new Date();
    if (!stored) throw new UnauthorizedException();
    if (stored.revokedAt) {
      // Token já rotacionado (ou do logout) usado de novo: sinal de roubo.
      // Derruba todas as sessões do usuário.
      await this.repository.revokeUserRefreshTokens(stored.userId, now);
      throw new UnauthorizedException();
    }
    if (stored.expiresAt <= now) throw new UnauthorizedException();
    const user = await this.repository.findCredentialsById(stored.userId);
    if (!user || !user.active) throw new UnauthorizedException();
    await this.repository.revokeRefreshToken(stored.id, now);
    return this.issueSession(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.repository.findRefreshToken(
      hashToken(refreshToken),
    );
    if (stored && !stored.revokedAt) {
      await this.repository.revokeRefreshToken(stored.id, new Date());
    }
  }

  /**
   * Troca a senha do próprio usuário (inclusive a provisória do primeiro
   * acesso). Encerra as outras sessões e devolve uma nova.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<SessionTokens> {
    const user = await this.repository.findCredentialsById(userId);
    if (!user || !user.active) throw new UnauthorizedException();
    if (!(await this.hasher.verify(currentPassword, user.passwordHash))) {
      throw new BadRequestException('A senha atual não confere.');
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual.');
    }
    await this.repository.updatePassword(
      userId,
      await this.hasher.hash(newPassword),
    );
    return this.issueSession({ ...user, mustChangePassword: false });
  }

  /** Troca de senha pendente e dono da conta, para a tela saber o que mostrar. */
  async getAccountFlags(
    userId: string,
  ): Promise<{ mustChangePassword: boolean; isOwner: boolean } | null> {
    const [credentials, [user]] = await Promise.all([
      this.repository.findCredentialsById(userId),
      this.repository.findUsersWithPermissions([userId]),
    ]);
    if (!credentials || !user) return null;
    return { mustChangePassword: credentials.mustChangePassword, isOwner: user.isOwner };
  }

  private async issueSession(user: UserCredentials): Promise<SessionTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      pv: user.permissionsVersion,
      ...(user.mustChangePassword && { mcp: true as const }),
    };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString('base64url');
    await this.repository.saveRefreshToken(
      user.id,
      hashToken(refreshToken),
      new Date(Date.now() + this.refreshTokenDays * DAY_MS),
    );
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
}
