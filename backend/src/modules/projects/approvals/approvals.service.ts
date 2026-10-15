import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { endOfLocalDay } from '../../../shared/time/timezone.js';
import { FULL, type UserPermissions } from '../../auth/public/index.js';
import { FILES_FACADE, type FilesReader } from '../../files/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import { DocumentAccessService, type DocumentAccess } from '../document-access.service.js';
import {
  approvalOutcome,
  ApprovalRuleError,
  checkApprovers,
  checkMarker,
  checkVote,
  type ApprovalDecision,
} from '../domain/approval-rules.js';
import { ProjectsNotifier, type NotifiedDocument } from '../projects-notifier.js';
import { APPROVAL_REPOSITORY, type ApprovalRecord, type ApprovalRepository } from '../repositories/approval.repository.js';
import type { ProjectDocType } from '../repositories/status.repository.js';

export interface ApprovalView extends Omit<ApprovalRecord, 'votes' | 'markers'> {
  file: { name: string; mimeType: string } | null;
  votes: ApprovalRecord['votes'];
  markers: ApprovalRecord['markers'];
  can: { vote: boolean; cancel: boolean; mark: boolean };
}

export interface PendingApprovalView extends ApprovalView {
  document: NotifiedDocument;
}

export interface ApprovalRequestInput {
  docType: ProjectDocType;
  docId: string;
  fileId: string;
  approverIds: string[];
  /** AAAA-MM-DD (fim do dia no fuso da agência) ou data e hora ISO. */
  deadline?: string | null;
}

function canCancel(record: ApprovalRecord, userId: string, access: UserPermissions): boolean {
  return record.requesterId === userId || access.modules[record.docType === 'PROJECT' ? 'projects' : 'jobs'] >= FULL;
}

/** Anexo do documento no módulo files (projeto ou job). */
const OWNER_TYPE: Record<ProjectDocType, string> = { PROJECT: 'project', JOB: 'job' };

/**
 * Aprovação de peças: quem pode alterar o documento pede a aprovação de um
 * anexo a envolvidos; cada aprovador vota uma vez (reprovar exige motivo);
 * marcadores comentam pontos da imagem.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(FILES_FACADE) private readonly files: FilesReader,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
    private readonly documents: DocumentAccessService,
    private readonly notifier: ProjectsNotifier,
  ) {}

  async list(userId: string, access: UserPermissions, docType: ProjectDocType, docId: string): Promise<ApprovalView[]> {
    const document = await this.documents.resolve(userId, access, docType, docId);
    const records = await this.approvals.listByDocument(docType, docId);
    return Promise.all(records.map((record) => this.toView(record, userId, document, access)));
  }

  /** Painel "aprovações para mim": abertas em que ainda não votei. */
  async pending(userId: string, access: UserPermissions): Promise<PendingApprovalView[]> {
    const records = await this.approvals.listPendingFor(userId);
    const views: PendingApprovalView[] = [];
    for (const record of records) {
      // Quem deixou de ver o documento (ex.: saiu do job) não vê o pedido.
      const document = await this.documents.resolve(userId, access, record.docType, record.docId).catch(() => null);
      if (document) views.push({ ...(await this.toView(record, userId, document, access)), document: document.document });
    }
    return views;
  }

  async request(userId: string, access: UserPermissions, input: ApprovalRequestInput): Promise<ApprovalView> {
    const document = await this.documents.resolve(userId, access, input.docType, input.docId);
    if (!document.canModerate) throw new ForbiddenException('Sem permissão para pedir aprovação neste documento.');
    const file = await this.files.getFile(input.fileId);
    if (!file || file.ownerType !== OWNER_TYPE[input.docType] || file.ownerId !== input.docId) {
      throw new BadRequestException('Anexo não encontrado neste documento.');
    }
    if (await this.approvals.hasOpenForFile(file.id)) {
      throw new BadRequestException('Este arquivo já está em aprovação.');
    }
    const approverIds = this.rule(() => checkApprovers(input.approverIds, userId, document.involvedUserIds));
    const record = await this.approvals.create({
      fileId: file.id,
      docType: input.docType,
      docId: input.docId,
      requesterId: userId,
      approverIds,
      deadline: await this.parseDeadline(input.deadline),
    });
    await this.notifier.approvalRequested(document.document, approverIds, userId, file.originalName);
    return this.toView(record, userId, document, access);
  }

  async vote(
    userId: string,
    access: UserPermissions,
    id: string,
    decision: ApprovalDecision,
    reason: string | null,
  ): Promise<ApprovalView> {
    const { record, document } = await this.requireRequest(userId, access, id);
    this.rule(() => checkVote(record, userId, decision, reason));
    const votes = [...record.votes, { userId, decision, reason: reason?.trim() || null, createdAt: new Date() }];
    const outcome = approvalOutcome(record.approverIds, votes);
    await this.approvals.vote(id, { userId, decision, reason: reason?.trim() || null }, outcome);
    if (outcome === 'APPROVED' || outcome === 'REJECTED') {
      const file = await this.files.getFile(record.fileId);
      await this.notifier.approvalDecided(document.document, outcome, record.requesterId, userId, file?.originalName ?? 'arquivo');
    }
    return this.reload(id, userId, document, access);
  }

  /** Cancelar: quem pediu ou quem tem nível Total no módulo do documento. */
  async cancel(userId: string, access: UserPermissions, id: string): Promise<ApprovalView> {
    const { record, document } = await this.requireRequest(userId, access, id);
    if (record.situation !== 'OPEN') throw new BadRequestException('Esta aprovação já foi encerrada.');
    if (!canCancel(record, userId, access)) {
      throw new ForbiddenException('Só quem pediu pode cancelar a aprovação.');
    }
    await this.approvals.setSituation(id, 'CANCELED');
    return this.reload(id, userId, document, access);
  }

  async addMarker(
    userId: string,
    access: UserPermissions,
    id: string,
    input: { x: number; y: number; text: string },
  ): Promise<ApprovalView> {
    const { record, document } = await this.requireRequest(userId, access, id);
    if (record.situation !== 'OPEN') throw new BadRequestException('Esta aprovação já foi encerrada.');
    if (!document.involvedUserIds.includes(userId)) throw new ForbiddenException('Só os envolvidos marcam a peça.');
    this.rule(() => checkMarker(input.x, input.y, input.text));
    await this.approvals.addMarker(id, { x: input.x, y: input.y, html: input.text.trim().slice(0, 2000), authorId: userId });
    return this.reload(id, userId, document, access);
  }

  async removeMarker(userId: string, access: UserPermissions, id: string, markerId: string): Promise<ApprovalView> {
    const { record, document } = await this.requireRequest(userId, access, id);
    const marker = record.markers.find((current) => current.id === markerId);
    if (!marker) throw new NotFoundException('Marcador não encontrado.');
    if (marker.authorId !== userId) throw new ForbiddenException('Só o autor apaga o marcador.');
    await this.approvals.deleteMarker(markerId);
    return this.reload(id, userId, document, access);
  }

  private async requireRequest(
    userId: string,
    access: UserPermissions,
    id: string,
  ): Promise<{ record: ApprovalRecord; document: DocumentAccess }> {
    const record = await this.approvals.findById(id);
    if (!record) throw new NotFoundException('Aprovação não encontrada.');
    const document = await this.documents.resolve(userId, access, record.docType, record.docId);
    return { record, document };
  }

  private async reload(id: string, userId: string, document: DocumentAccess, access: UserPermissions): Promise<ApprovalView> {
    return this.toView((await this.approvals.findById(id))!, userId, document, access);
  }

  private async toView(
    record: ApprovalRecord,
    userId: string,
    document: DocumentAccess,
    access: UserPermissions,
  ): Promise<ApprovalView> {
    const file = await this.files.getFile(record.fileId);
    const open = record.situation === 'OPEN';
    return {
      ...record,
      file: file ? { name: file.originalName, mimeType: file.mimeType } : null,
      can: {
        vote: open && record.approverIds.includes(userId) && !record.votes.some((vote) => vote.userId === userId),
        cancel: open && canCancel(record, userId, access),
        mark: open && document.involvedUserIds.includes(userId),
      },
    };
  }

  private async parseDeadline(value: string | null | undefined): Promise<Date | null> {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return endOfLocalDay(value, (await this.settings.getAgency()).timezone);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Prazo inválido.');
    return date;
  }

  private rule<T>(check: () => T): T {
    try {
      return check();
    } catch (error) {
      if (error instanceof ApprovalRuleError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
