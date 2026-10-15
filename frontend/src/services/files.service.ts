import type { HttpClient } from './http';
import type { UserRef } from './types';

/** Documentos que aceitam anexos (o back-end confere o acesso de cada um). */
export type FileOwnerType = 'project' | 'job' | 'task' | 'media' | 'production' | 'party' | 'bill';

export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  createdAt: string;
  uploadedBy: UserRef | null;
  canChange: boolean;
}

export interface FileList {
  items: StoredFile[];
  canChange: boolean;
}

export interface FilesUsage {
  usedBytes: number;
  quotaBytes: number | null;
  maxFileBytes: number;
}

export class FilesService {
  constructor(private readonly http: HttpClient) {}

  list(ownerType: FileOwnerType, ownerId: string) {
    return this.http.get<FileList>('/files', { ownerType, ownerId });
  }
  upload(ownerType: FileOwnerType, ownerId: string, files: File[]) {
    const form = new FormData();
    form.set('ownerType', ownerType);
    form.set('ownerId', ownerId);
    for (const file of files) form.append('files', file, file.name);
    return this.http.upload<FileList>('/files', form);
  }
  describe(id: string, description: string | null) {
    return this.http.patch<StoredFile>(`/files/${id}`, { description });
  }
  remove(id: string) {
    return this.http.delete<void>(`/files/${id}`);
  }
  /** Link temporário (5 min) para ver no navegador ou baixar. */
  url(id: string, inline = false) {
    return this.http.get<{ url: string; expiresAt: string }>(`/files/${id}/url`, { inline: inline || undefined });
  }
  usage() {
    return this.http.get<FilesUsage>('/files/usage');
  }
}
