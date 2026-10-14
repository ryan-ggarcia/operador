import type { HttpClient, TokenStore } from './http';
import type {
  AccessProfile,
  Session,
  Team,
  UserPermissions,
  UserRecord,
  UserRef,
  UserSummary,
} from './types';

export class AuthService {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStore,
  ) {}

  hasSession(): boolean {
    return this.tokens.get() !== null;
  }

  async login(email: string, password: string): Promise<Session> {
    const session = await this.http.post<Session>('/auth/login', { email, password }, { anonymous: true });
    this.tokens.set(session);
    return session;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<Session> {
    const session = await this.http.post<Session>('/auth/password', { currentPassword, newPassword });
    this.tokens.set(session);
    return session;
  }

  async logout(): Promise<void> {
    const current = this.tokens.get();
    this.tokens.set(null);
    if (current) {
      await this.http
        .post('/auth/logout', { refreshToken: current.refreshToken }, { anonymous: true })
        .catch(() => undefined);
    }
  }

  me() {
    return this.http.get<{ user: UserSummary; permissions: UserPermissions }>('/auth/me');
  }
}

export interface CreateUserInput {
  email: string;
  name?: string;
  accessProfileId: string;
  temporaryPassword: string;
  teamIds?: string[];
}

export class UsersService {
  constructor(private readonly http: HttpClient) {}

  options() {
    return this.http.get<UserRef[]>('/users/options');
  }
  list(query: { active?: boolean; search?: string } = {}) {
    return this.http.get<UserRecord[]>('/users', query);
  }
  create(input: CreateUserInput) {
    return this.http.post<UserRecord>('/users', input);
  }
  update(id: string, input: { name?: string; accessProfileId?: string; teamIds?: string[] }) {
    return this.http.patch<UserRecord>(`/users/${id}`, input);
  }
  setActive(id: string, active: boolean) {
    return this.http.post<UserRecord>(`/users/${id}/${active ? 'activate' : 'deactivate'}`);
  }
  resetPassword(id: string, temporaryPassword: string) {
    return this.http.post<void>(`/users/${id}/password`, { temporaryPassword });
  }
  profiles() {
    return this.http.get<AccessProfile[]>('/access-profiles');
  }
  teams() {
    return this.http.get<Team[]>('/teams');
  }
}
