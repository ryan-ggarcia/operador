/**
 * Cliente HTTP da API do operador. Os componentes não chamam fetch direto:
 * usam os serviços de src/services, que dependem desta classe.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/** Onde os tokens ficam guardados (trocável nos testes). */
export interface TokenStore {
  get(): Tokens | null;
  set(tokens: Tokens | null): void;
}

export type Query = Record<string, string | number | boolean | string[] | null | undefined>;

interface RequestOptions {
  body?: unknown;
  query?: Query;
  /** Rotas públicas (login, refresh) não mandam o token. */
  anonymous?: boolean;
}

function toMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
  }
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status >= 500) return 'Erro no servidor. Tente de novo em instantes.';
  return 'Não foi possível concluir a ação.';
}

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export class HttpClient {
  private refreshing: Promise<boolean> | null = null;
  /** Chamado quando a sessão não pode ser renovada (vai para o login). */
  onSessionExpired: () => void = () => {};

  constructor(
    private readonly baseUrl: string,
    private readonly tokens: TokenStore,
  ) {}

  get<T>(path: string, query?: Query) {
    return this.request<T>('GET', path, { query });
  }
  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'body'> = {}) {
    return this.request<T>('POST', path, { ...options, body });
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, { body });
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, { body });
  }
  delete<T>(path: string) {
    return this.request<T>('DELETE', path, {});
  }
  /** Envio multipart (anexos): o navegador monta o content-type com o boundary. */
  upload<T>(path: string, form: FormData) {
    return this.request<T>('POST', path, { body: form });
  }

  async request<T>(method: string, path: string, options: RequestOptions, retry = true): Promise<T> {
    const token = options.anonymous ? null : this.tokens.get()?.accessToken;
    const isForm = options.body instanceof FormData;
    let response: Response;
    try {
      response = await fetch(this.baseUrl + path + buildQuery(options.query), {
        method,
        headers: {
          ...(options.body === undefined || isForm ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: isForm
          ? (options.body as FormData)
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiError(0, 'Sem conexão com o servidor.');
    }

    if (response.status === 401 && !options.anonymous && retry) {
      if (await this.refresh()) return this.request<T>(method, path, options, false);
      this.tokens.set(null);
      this.onSessionExpired();
    }

    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new ApiError(response.status, toMessage(data, response.status), data);
    return data as T;
  }

  /** Renova o token uma vez só, mesmo com várias requisições ao mesmo tempo. */
  private refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      const current = this.tokens.get();
      if (!current) return false;
      try {
        const session = await this.request<Tokens>(
          'POST',
          '/auth/refresh',
          { body: { refreshToken: current.refreshToken }, anonymous: true },
          false,
        );
        this.tokens.set({ accessToken: session.accessToken, refreshToken: session.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }
}

/** Tokens no localStorage do navegador. */
export class LocalTokenStore implements TokenStore {
  private static readonly KEY = 'operador.session';

  get(): Tokens | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(LocalTokenStore.KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  }

  set(tokens: Tokens | null): void {
    if (typeof window === 'undefined') return;
    if (tokens) window.localStorage.setItem(LocalTokenStore.KEY, JSON.stringify(tokens));
    else window.localStorage.removeItem(LocalTokenStore.KEY);
  }
}
