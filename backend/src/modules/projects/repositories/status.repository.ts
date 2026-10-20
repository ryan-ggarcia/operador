export const STATUS_REPOSITORY = Symbol('STATUS_REPOSITORY');
export const COMMENT_REPOSITORY = Symbol('COMMENT_REPOSITORY');

export type ProjectDocType = 'PROJECT' | 'JOB';

export interface StatusRecord {
  id: string;
  docType: ProjectDocType;
  name: string;
  color: string;
  order: number;
  active: boolean;
  ignoresDelay: boolean;
  system: boolean;
  groupId: string | null;
}

export interface StatusData {
  name: string;
  color: string;
  active: boolean;
  ignoresDelay: boolean;
  groupId: string | null;
}

export interface PredefinedBriefingRecord {
  id: string;
  docType: ProjectDocType;
  title: string;
  html: string;
  active: boolean;
}

/** Status de projeto e de job/tarefa, e briefings predefinidos. */
export interface StatusRepository {
  list(docType: ProjectDocType, includeInactive: boolean): Promise<StatusRecord[]>;
  findById(id: string): Promise<StatusRecord | null>;
  nameInUse(docType: ProjectDocType, name: string, exceptId?: string): Promise<boolean>;
  create(docType: ProjectDocType, data: StatusData): Promise<StatusRecord>;
  update(id: string, data: Partial<StatusData>): Promise<StatusRecord>;
  /** Grava a nova ordem (ids na ordem desejada). */
  reorder(docType: ProjectDocType, ids: string[]): Promise<void>;

  listBriefings(docType: ProjectDocType, includeInactive: boolean): Promise<PredefinedBriefingRecord[]>;
  findBriefing(id: string): Promise<PredefinedBriefingRecord | null>;
  createBriefing(docType: ProjectDocType, title: string, html: string): Promise<PredefinedBriefingRecord>;
  updateBriefing(
    id: string,
    data: { title?: string; html?: string; active?: boolean },
  ): Promise<PredefinedBriefingRecord>;
}

export interface CommentRecord {
  id: string;
  docType: ProjectDocType;
  docId: string;
  authorId: string;
  html: string;
  mentionedUserIds: string[];
  parentId: string | null;
  fileId: string | null;
  pinned: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewComment {
  docType: ProjectDocType;
  docId: string;
  authorId: string;
  html: string;
  mentionedUserIds: string[];
  parentId: string | null;
  fileId: string | null;
}

/** Comentários (interações) de projetos e jobs. */
export interface CommentRepository {
  list(docType: ProjectDocType, docId: string): Promise<CommentRecord[]>;
  findById(id: string): Promise<CommentRecord | null>;
  create(data: NewComment): Promise<CommentRecord>;
  update(
    id: string,
    data: { html?: string; mentionedUserIds?: string[]; pinned?: boolean; active?: boolean },
  ): Promise<CommentRecord>;
}
