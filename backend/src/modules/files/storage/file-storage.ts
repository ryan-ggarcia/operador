/** Token de injeção do storage dos anexos. */
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface DownloadOptions {
  /** Nome com que o arquivo é baixado. */
  fileName: string;
  mimeType: string;
  expiresInSeconds: number;
  /** Abrir no navegador (imagem, PDF) em vez de baixar. */
  inline: boolean;
}

/**
 * Onde os bytes dos anexos ficam. Em produção, Supabase Storage (bucket
 * privado); no desenvolvimento, uma pasta local. Os metadados ficam no banco.
 */
export interface FileStorage {
  put(key: string, content: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(keys: string[]): Promise<void>;
  /** Link temporário para baixar ou ver o arquivo sem o token da API. */
  downloadUrl(key: string, options: DownloadOptions): Promise<string>;
  /**
   * Só para storages que servem o próprio link pela API (o local): confere
   * o link assinado e devolve o arquivo. Os outros não implementam.
   */
  readSigned?(token: string): Promise<SignedContent | null>;
}

export interface SignedContent {
  content: Buffer;
  fileName: string;
  mimeType: string;
  inline: boolean;
}
