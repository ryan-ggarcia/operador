import type { UserPermissions } from '../../auth/public/index.js';

/** Token de injeção da fachada do módulo files. */
export const FILES_FACADE = Symbol('FILES_FACADE');

/** O que o usuário pode fazer com os anexos de um documento. */
export interface FileOwnerAccess {
  canView: boolean;
  /** Enviar, descrever e excluir anexos. */
  canChange: boolean;
}

/**
 * Cada módulo dono de documentos com anexos (jobs, mídias, cadastros…)
 * registra um resolvedor: o módulo files não conhece as regras de acesso
 * dos outros, só pergunta a eles.
 */
export interface FileOwnerResolver {
  /** Módulo dono (guardado no anexo). */
  readonly module: string;
  /** Tipos de documento atendidos (ex.: 'job', 'project'). */
  readonly ownerTypes: readonly string[];
  /** Nulo quando o documento não existe ou o usuário não pode vê-lo. */
  resolve(ownerType: string, ownerId: string, userId: string, access: UserPermissions): Promise<FileOwnerAccess | null>;
}

export interface FileSummary {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  ownerModule: string;
  ownerType: string;
  ownerId: string;
}

/** Registro dos donos de anexos (I: separado da leitura). */
export interface FileOwnerRegistry {
  registerOwner(resolver: FileOwnerResolver): void;
}

/** Leitura de anexos por outros módulos (ex.: logo da agência nos PDFs). */
export interface FilesReader {
  /** Quantos anexos ativos cada documento tem. */
  countByOwners(ownerType: string, ownerIds: string[]): Promise<Record<string, number>>;
  getFile(id: string): Promise<FileSummary | null>;
  readContent(id: string): Promise<Buffer | null>;
}

/** Interface pública do módulo files. */
export interface FilesFacade extends FileOwnerRegistry, FilesReader {}
