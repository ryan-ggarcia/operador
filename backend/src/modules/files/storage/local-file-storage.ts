import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { signGrant, verifyGrant } from '../domain/file-rules.js';
import type { DownloadOptions, FileStorage, SignedContent } from './file-storage.js';

/**
 * Storage em pasta local (desenvolvimento e testes). O link de download
 * aponta para a própria API (/files/content/:token), assinado com HMAC.
 */
@Injectable()
export class LocalFileStorage implements FileStorage {
  private readonly root: string;
  private readonly secret: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('FILES_LOCAL_DIR') || 'storage');
    this.secret = config.get<string>('FILES_URL_SECRET') || config.getOrThrow<string>('JWT_SECRET');
    this.publicUrl = (config.get<string>('API_PUBLIC_URL') || `http://localhost:${config.get('PORT', 3001)}`).replace(/\/$/, '');
  }

  async put(key: string, content: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { flag: 'wx' });
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.pathOf(key), { force: true })));
  }

  async downloadUrl(key: string, options: DownloadOptions): Promise<string> {
    const token = signGrant(
      {
        key,
        name: options.fileName,
        mimeType: options.mimeType,
        expiresAt: Date.now() + options.expiresInSeconds * 1000,
        inline: options.inline,
      },
      this.secret,
    );
    return `${this.publicUrl}/files/content/${token}`;
  }

  async readSigned(token: string): Promise<SignedContent | null> {
    const grant = verifyGrant(token, this.secret);
    if (!grant) return null;
    const content = await this.get(grant.key);
    return content && { content, fileName: grant.name, mimeType: grant.mimeType, inline: grant.inline };
  }

  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error('Chave de arquivo inválida.');
    return path;
  }
}
