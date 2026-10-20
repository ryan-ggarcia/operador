import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DownloadOptions, FileStorage } from './file-storage.js';

/** Quem faz as requisições HTTP (trocável nos testes). */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export const FETCHER = Symbol('FETCHER');

/**
 * Supabase Storage pela API REST, com a chave de serviço (só no back-end).
 * O bucket é privado: o download sempre usa link assinado e temporário.
 */
@Injectable()
export class SupabaseFileStorage implements FileStorage {
  private readonly baseUrl: string;
  private readonly bucket: string;
  private readonly serviceKey: string;
  private readonly fetcher: Fetcher;

  constructor(config: ConfigService, @Optional() @Inject(FETCHER) fetcher?: Fetcher) {
    this.fetcher = fetcher ?? fetch;
    this.baseUrl = `${config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '')}/storage/v1`;
    this.bucket = config.get<string>('SUPABASE_BUCKET') || 'anexos';
    this.serviceKey = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
  }

  async put(key: string, content: Buffer, mimeType: string): Promise<void> {
    await this.call(`/object/${this.bucket}/${encodePath(key)}`, {
      method: 'POST',
      headers: { 'content-type': mimeType, 'x-upsert': 'false' },
      body: new Uint8Array(content),
    });
  }

  async get(key: string): Promise<Buffer | null> {
    const response = await this.fetcher(`${this.baseUrl}/object/authenticated/${this.bucket}/${encodePath(key)}`, {
      headers: this.headers(),
    });
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new Error(`Supabase Storage: ${response.status} ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }

  async remove(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.call(`/object/${this.bucket}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: keys }),
    });
  }

  async downloadUrl(key: string, options: DownloadOptions): Promise<string> {
    const response = await this.call(`/object/sign/${this.bucket}/${encodePath(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expiresIn: options.expiresInSeconds }),
    });
    const { signedURL } = (await response.json()) as { signedURL: string };
    const url = new URL(`${this.baseUrl}${signedURL}`);
    if (!options.inline) url.searchParams.set('download', options.fileName);
    return url.toString();
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey, ...extra };
  }

  private async call(path: string, init: RequestInit & { headers: Record<string, string> }): Promise<Response> {
    const response = await this.fetcher(this.baseUrl + path, { ...init, headers: this.headers(init.headers) });
    if (!response.ok) throw new Error(`Supabase Storage: ${response.status} ${await response.text()}`);
    return response;
  }
}

function encodePath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
