import { createHmac, timingSafeEqual } from 'node:crypto';

/** Regras puras dos anexos: nomes, chaves no storage, cota e links. */

export class FileRuleError extends Error {}

/**
 * O multer lê o nome do arquivo como latin1; nomes com acento chegam
 * embaralhados ("PeÃ§a.pdf"). Volta para UTF-8 quando a conversão é válida.
 */
export function fixUploadName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

/** Nome seguro para a chave do storage: sem acento, barras nem espaços. */
export function safeFileName(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\./g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(-120);
  return base || 'arquivo';
}

/** Chave no storage: módulo/tipo/dono/id-nome. */
export function storageKey(owner: { module: string; type: string; id: string }, fileId: string, name: string): string {
  return `${owner.module}/${owner.type}/${owner.id}/${fileId}-${safeFileName(name)}`;
}

/** Confere tamanho máximo por arquivo e a cota total da conta. */
export function checkUpload(input: {
  sizes: number[];
  maxFileBytes: number;
  usedBytes: number;
  quotaBytes: number | null;
}): void {
  if (input.sizes.length === 0) throw new FileRuleError('Escolha pelo menos um arquivo.');
  if (input.sizes.some((size) => size === 0)) throw new FileRuleError('Há arquivo vazio.');
  if (input.sizes.some((size) => size > input.maxFileBytes)) {
    throw new FileRuleError(`Cada arquivo pode ter no máximo ${formatBytes(input.maxFileBytes)}.`);
  }
  const total = input.sizes.reduce((sum, size) => sum + size, 0);
  if (input.quotaBytes !== null && input.usedBytes + total > input.quotaBytes) {
    throw new FileRuleError(
      `Espaço de anexos esgotado (${formatBytes(input.usedBytes)} de ${formatBytes(input.quotaBytes)}). Exclua arquivos antigos para enviar novos.`,
    );
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/** Tipos que o navegador mostra direto (o resto é baixado). */
export function isInlineType(mimeType: string): boolean {
  return /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|video\/(mp4|webm)|audio\/(mpeg|ogg|wav)|text\/plain)$/.test(
    mimeType,
  );
}

/** Link assinado do storage local: chave, nome e validade, com HMAC. */
export interface DownloadGrant {
  key: string;
  name: string;
  mimeType: string;
  /** Validade em milissegundos desde a época. */
  expiresAt: number;
  inline: boolean;
}

export function signGrant(grant: DownloadGrant, secret: string): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** Nulo se a assinatura não confere ou o link venceu. */
export function verifyGrant(token: string, secret: string, now = Date.now()): DownloadGrant | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DownloadGrant;
    return grant.expiresAt > now ? grant : null;
  } catch {
    return null;
  }
}

/** Cabeçalho Content-Disposition com nome em UTF-8 (RFC 6266). */
export function contentDisposition(name: string, inline: boolean): string {
  const ascii = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
