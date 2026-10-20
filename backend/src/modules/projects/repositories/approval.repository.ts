import type { ApprovalDecision, ApprovalSituation } from '../domain/approval-rules.js';
import type { ProjectDocType } from './status.repository.js';

export const APPROVAL_REPOSITORY = Symbol('APPROVAL_REPOSITORY');

export interface ApprovalVoteRecord {
  userId: string;
  decision: ApprovalDecision;
  reason: string | null;
  createdAt: Date;
}

export interface ApprovalMarkerRecord {
  id: string;
  x: number;
  y: number;
  html: string;
  authorId: string;
  createdAt: Date;
}

export interface ApprovalRecord {
  id: string;
  fileId: string;
  docType: ProjectDocType;
  docId: string;
  requesterId: string;
  approverIds: string[];
  deadline: Date | null;
  situation: ApprovalSituation;
  createdAt: Date;
  updatedAt: Date;
  votes: ApprovalVoteRecord[];
  markers: ApprovalMarkerRecord[];
}

export interface NewApproval {
  fileId: string;
  docType: ProjectDocType;
  docId: string;
  requesterId: string;
  approverIds: string[];
  deadline: Date | null;
}

export interface ApprovalRepository {
  listByDocument(docType: ProjectDocType, docId: string): Promise<ApprovalRecord[]>;
  /** Abertas em que o usuário é aprovador e ainda não votou. */
  listPendingFor(userId: string): Promise<ApprovalRecord[]>;
  findById(id: string): Promise<ApprovalRecord | null>;
  hasOpenForFile(fileId: string): Promise<boolean>;
  create(data: NewApproval): Promise<ApprovalRecord>;
  /** Grava o voto e a nova situação juntos. */
  vote(id: string, vote: Omit<ApprovalVoteRecord, 'createdAt'>, situation: ApprovalSituation): Promise<void>;
  setSituation(id: string, situation: ApprovalSituation): Promise<void>;
  addMarker(id: string, marker: Omit<ApprovalMarkerRecord, 'id' | 'createdAt'>): Promise<void>;
  deleteMarker(markerId: string): Promise<void>;
}
