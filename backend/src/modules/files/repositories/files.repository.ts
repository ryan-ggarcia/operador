export const FILES_REPOSITORY = Symbol('FILES_REPOSITORY');

export interface FileRecord {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  ownerModule: string;
  ownerType: string;
  ownerId: string;
  description: string | null;
  uploadedById: string;
  active: boolean;
  createdAt: Date;
}

export type NewFile = Omit<FileRecord, 'active' | 'createdAt'>;

export interface FilesRepository {
  listByOwner(ownerType: string, ownerId: string): Promise<FileRecord[]>;
  countByOwners(ownerType: string, ownerIds: string[]): Promise<Record<string, number>>;
  findById(id: string): Promise<FileRecord | null>;
  create(files: NewFile[]): Promise<FileRecord[]>;
  updateDescription(id: string, description: string | null): Promise<FileRecord>;
  deactivate(id: string): Promise<void>;
  /** Bytes dos anexos ativos (cota da conta). */
  usedBytes(): Promise<number>;
}
