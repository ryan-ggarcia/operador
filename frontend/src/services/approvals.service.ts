import type { HttpClient } from './http';

export type ApprovalDocType = 'PROJECT' | 'JOB';
export type ApprovalSituation = 'OPEN' | 'APPROVED' | 'REJECTED' | 'CANCELED';
export type ApprovalDecision = 'APPROVE' | 'REJECT';

export interface ApprovalMarker {
  id: string;
  x: number;
  y: number;
  html: string;
  authorId: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  fileId: string;
  file: { name: string; mimeType: string } | null;
  docType: ApprovalDocType;
  docId: string;
  requesterId: string;
  approverIds: string[];
  deadline: string | null;
  situation: ApprovalSituation;
  createdAt: string;
  votes: { userId: string; decision: ApprovalDecision; reason: string | null; createdAt: string }[];
  markers: ApprovalMarker[];
  can: { vote: boolean; cancel: boolean; mark: boolean };
}

export interface PendingApproval extends Approval {
  document: { label: string; link: string };
}

export const APPROVAL_SITUATION_LABEL: Record<ApprovalSituation, string> = {
  OPEN: 'Em aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  CANCELED: 'Aprovação cancelada',
};

export class ApprovalsService {
  constructor(private readonly http: HttpClient) {}

  list(docType: ApprovalDocType, docId: string) {
    return this.http.get<Approval[]>('/approvals', { docType, docId });
  }
  pending() {
    return this.http.get<PendingApproval[]>('/approvals/pending');
  }
  request(input: {
    docType: ApprovalDocType;
    docId: string;
    fileId: string;
    approverIds: string[];
    deadline?: string | null;
  }) {
    return this.http.post<Approval>('/approvals', input);
  }
  vote(id: string, decision: ApprovalDecision, reason?: string | null) {
    return this.http.post<Approval>(`/approvals/${id}/vote`, { decision, reason });
  }
  cancel(id: string) {
    return this.http.post<Approval>(`/approvals/${id}/cancel`);
  }
  addMarker(id: string, marker: { x: number; y: number; text: string }) {
    return this.http.post<Approval>(`/approvals/${id}/markers`, marker);
  }
  removeMarker(id: string, markerId: string) {
    return this.http.delete<Approval>(`/approvals/${id}/markers/${markerId}`);
  }
}
