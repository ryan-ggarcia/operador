import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diffFields } from '../../../shared/history/diff.js';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import { endOfLocalDay } from '../../../shared/time/timezone.js';
import type { Page } from '../../../shared/validation/pagination.js';
import { AUTH_FACADE, READ_ALL, type AuthFacade, type UserPermissions } from '../../auth/public/index.js';
import { CRM_FACADE, type CrmFacade } from '../../crm/public/index.js';
import { PROJECTS_FACADE, type ProjectsFacade } from '../../projects/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import {
  canActOnMedia,
  canCreateMedia,
  canEditMedia,
  canViewMedia,
  nextMediaSituation,
  nextPieceLetter,
} from '../domain/media-access.js';
import {
  billingPlan,
  biweeksQuantity,
  dailyInsertionsQuantity,
  gridTotals,
  lineSubtotal,
  MediaMathError,
  mediaTotals,
  type GridTotals,
  type MediaTerms,
  type MediaTotals,
  type PlannedInvoice,
} from '../domain/media-math.js';
import {
  MEDIA_CATALOG_REPOSITORY,
  MEDIA_REPOSITORY,
  type GridRecord,
  type LineData,
  type MediaCatalogRepository,
  type MediaDetail,
  type MediaHeader,
  type MediaRecord,
  type MediaRepository,
  type MediaSituation,
  type MediaType,
  type PieceRecord,
} from '../repositories/media.repository.js';

/** Comissão padrão da agência (docs/operand/midia.md, 2.8: 20%). */
export const DEFAULT_COMMISSION_PERCENT = 20;

const HISTORY_FIELDS = [
  'title', 'vehicleId', 'vehicleContactId', 'networkId', 'channel', 'target', 'estimateNumber',
  'responsibleId', 'statusId', 'deadline', 'documentDate', 'commissionType', 'commissionValue',
  'negotiatedCommission', 'feeType', 'feeValue', 'discountType', 'discountValue', 'billingType',
  'firstDueDate', 'paymentCondition', 'vehicleNotes', 'clientNotes', 'briefing',
] as const;

export interface MediaListQuery {
  search?: string;
  mediaTypes?: MediaType[];
  situations?: MediaSituation[];
  clientId?: string;
  vehicleId?: string;
  projectId?: string;
  statusIds?: string[];
  mine?: boolean;
  limit: number;
  offset: number;
}

export interface CreateMediaInput {
  title: string;
  clientId: string;
  projectId?: string | null;
  mediaType: MediaType;
  vehicleId?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  /** AAAA-MM-DD: vale até o fim do dia no fuso da agência. */
  deadline?: string | null;
  briefing?: string | null;
}

/** Cabeçalho como chega da API (datas em texto AAAA-MM-DD). */
export type MediaHeaderInput = Partial<
  Omit<MediaHeader, 'deadline' | 'documentDate' | 'firstDueDate'> & {
    deadline: string | null;
    documentDate: string | null;
    firstDueDate: string | null;
  }
>;

export interface LineInput {
  pieceId?: string | null;
  programId?: string | null;
  product?: string | null;
  location?: string | null;
  section?: string | null;
  position?: string | null;
  color?: string | null;
  format?: string | null;
  placementType?: string | null;
  costMetricId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  biweeks?: number[] | null;
  dailyInsertions?: Record<string, number> | null;
  insertions?: number;
  unitValue?: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  isBonus?: boolean;
}

export interface GridInput {
  marketId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

type Ref = { id: string; name: string } | null;

export interface MediaListView {
  id: string;
  number: string;
  title: string;
  mediaType: MediaType;
  client: Ref;
  vehicle: Ref;
  project: { id: string; number: number; title: string } | null;
  responsible: { id: string; name: string; color: string | null } | null;
  statusId: string | null;
  situation: MediaSituation;
  deadline: Date | null;
  overdue: boolean;
  grossTotal: number;
  netValue: number;
  sentToFinanceAt: Date | null;
  createdAt: Date;
}

export interface MediaView extends MediaListView, Omit<MediaHeader, 'title' | 'deadline' | 'statusId' | 'responsibleId' | 'vehicleId' | 'vehicleContactId'> {
  vehicleContact: Ref;
  requester: { id: string; name: string; color: string | null } | null;
  members: { id: string; name: string; color: string | null }[];
  pieces: PieceRecord[];
  grids: (GridRecord & { totals: GridTotals })[];
  totals: MediaTotals | null;
  invoices: PlannedInvoice[];
  /** Problemas que impedem calcular os totais ou as faturas. */
  warnings: string[];
  can: { edit: boolean; act: boolean };
}

const toDateOnly = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`Data inválida: ${value}.`);
  return new Date(`${value}T00:00:00.000Z`);
};

const dateKey = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

/** Mídias (PI): documento, peças, grades, linhas e totais. */
@Injectable()
export class MediasService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly medias: MediaRepository,
    @Inject(MEDIA_CATALOG_REPOSITORY) private readonly catalog: MediaCatalogRepository,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
    @Inject(CRM_FACADE) private readonly crm: CrmFacade,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
  ) {}

  async list(userId: string, access: UserPermissions, query: MediaListQuery): Promise<Page<MediaListView>> {
    const page = await this.medias.list({
      ...query,
      visibility: { userId, readAll: access.modules.medias >= READ_ALL },
    });
    const names = await this.names(page.items);
    const now = new Date();
    return { total: page.total, items: page.items.map((media) => this.toListView(media, names, now)) };
  }

  async get(userId: string, access: UserPermissions, id: string): Promise<MediaView> {
    const media = await this.requireViewable(userId, access, id);
    const names = await this.names([media]);
    const warnings: string[] = [];
    const grids = media.grids.map((grid) => ({ ...grid, totals: gridTotals(grid.lines.map(toLineValues)) }));
    let totals: MediaTotals | null = null;
    let invoices: PlannedInvoice[] = [];
    try {
      totals = mediaTotals(grids.map((grid) => grid.totals), termsOf(media));
      if (media.billingType) {
        invoices = billingPlan(media.billingType, totals, media.negotiatedCommission != null);
      }
    } catch (error) {
      if (!(error instanceof MediaMathError)) throw error;
      warnings.push(error.message);
    }
    if (!media.vehicleId) warnings.push('Escolha o veículo.');
    if (!media.billingType) warnings.push('Escolha o tipo de faturamento.');
    const {
      vehicleId, vehicleContactId, responsibleId, requesterId, memberIds, statusIgnoresDelay,
      projectId, sequence, clientId, grossTotal, bonusTotal, netValue, closedAt, pieces, grids: rawGrids,
      ...header
    } = media;
    void vehicleId; void responsibleId; void requesterId; void memberIds; void statusIgnoresDelay;
    void projectId; void sequence; void clientId; void grossTotal; void bonusTotal; void netValue;
    void closedAt; void rawGrids;
    return {
      ...header,
      ...this.toListView(media, names, new Date()),
      vehicleContact: names.contact(vehicleContactId),
      requester: names.user(media.requesterId),
      members: media.memberIds.map((member) => names.user(member)).filter((user) => user !== null),
      pieces,
      grids,
      totals,
      invoices,
      warnings,
      can: {
        edit: canEditMedia(userId, access, media),
        act: canActOnMedia(userId, access, media),
      },
    };
  }

  async create(userId: string, access: UserPermissions, input: CreateMediaInput): Promise<MediaView> {
    if (!canCreateMedia(access)) throw new ForbiddenException('Sem permissão para criar mídias.');
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título.');
    const client = await this.crm.getParty(input.clientId);
    if (!client || !client.active || !client.roles.includes('client')) {
      throw new BadRequestException('Cliente não encontrado ou inativo.');
    }
    if (input.vehicleId) await this.requireVehicle(input.vehicleId);
    if (input.responsibleId) await this.requireActiveUser(input.responsibleId);
    if (input.statusId) await this.requireStatus(input.statusId);

    let projectId = input.projectId ?? null;
    if (projectId) {
      const project = await this.projects.getProject(projectId);
      if (!project || project.clientId !== input.clientId) {
        throw new BadRequestException('Projeto não encontrado para este cliente.');
      }
    } else {
      // Sem projeto, a mídia vai para o projeto "Geral" do cliente, como o job.
      projectId = (await this.projects.ensureClientDefaultProject(input.clientId)).id;
    }
    // Jobs, mídias e produções dividem a numeração do projeto.
    const { sequence } = await this.projects.reserveDocumentSequence(projectId);
    const media = await this.medias.create(
      {
        projectId,
        sequence,
        clientId: input.clientId,
        title,
        mediaType: input.mediaType,
        vehicleId: input.vehicleId ?? null,
        responsibleId: input.responsibleId ?? null,
        requesterId: userId,
        statusId: input.statusId ?? null,
        deadline: await this.parseDeadline(input.deadline),
        briefing: sanitizeRichText(input.briefing),
        commissionValue: DEFAULT_COMMISSION_PERCENT,
      },
      userId,
    );
    return this.get(userId, access, media.id);
  }

  /**
   * Altera o cabeçalho. Trocar o veículo (ou o canal, na TV) apaga as
   * grades: sem confirmClearGrids, a API responde 409 pedindo confirmação.
   */
  async update(
    userId: string,
    access: UserPermissions,
    id: string,
    input: MediaHeaderInput,
    confirmClearGrids = false,
  ): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    const { deadline, documentDate, firstDueDate, ...rest } = input;
    const changes: Partial<MediaHeader> = {
      ...rest,
      title: rest.title?.trim() || undefined,
      deadline: deadline === undefined ? undefined : await this.parseDeadline(deadline),
      documentDate: toDateOnly(documentDate),
      firstDueDate: toDateOnly(firstDueDate),
      briefing: rest.briefing === undefined ? undefined : sanitizeRichText(rest.briefing),
      vehicleNotes: rest.vehicleNotes === undefined ? undefined : rest.vehicleNotes?.trim() || null,
      clientNotes: rest.clientNotes === undefined ? undefined : rest.clientNotes?.trim() || null,
    };
    for (const key of Object.keys(changes) as (keyof MediaHeader)[]) {
      if (changes[key] === undefined) delete changes[key];
    }

    const vehicleChanged = changes.vehicleId !== undefined && changes.vehicleId !== media.vehicleId;
    const channelChanged = media.mediaType === 'TV' && changes.channel !== undefined && changes.channel !== media.channel;
    const clearGrids = (vehicleChanged || channelChanged) && media.grids.length > 0;
    if (clearGrids && !confirmClearGrids) {
      throw new ConflictException({
        message: vehicleChanged
          ? 'Trocar o veículo apaga as grades da mídia (as peças ficam). Confirme para continuar.'
          : 'Trocar o canal apaga as grades da mídia (as peças ficam). Confirme para continuar.',
        code: 'GRIDS_WILL_BE_CLEARED',
      });
    }
    if (changes.vehicleId) await this.requireVehicle(changes.vehicleId);
    const vehicleId = changes.vehicleId === undefined ? media.vehicleId : changes.vehicleId;
    if (vehicleChanged && changes.vehicleContactId === undefined) changes.vehicleContactId = null;
    if (changes.vehicleContactId) {
      const [contact] = await this.crm.getContacts([changes.vehicleContactId]);
      if (!contact || contact.partyId !== vehicleId) throw new BadRequestException('O contato não é deste veículo.');
    }
    if (changes.networkId && !(await this.catalog.findNetwork(changes.networkId))) {
      throw new BadRequestException('Rede não encontrada.');
    }
    if (changes.responsibleId) await this.requireActiveUser(changes.responsibleId);
    if (changes.statusId) await this.requireStatus(changes.statusId);

    // As novas condições precisam fechar a conta (comissão, descontos, tipo).
    const next = { ...media, ...changes };
    try {
      const grids = clearGrids ? [] : media.grids.map((grid) => gridTotals(grid.lines.map(toLineValues)));
      const totals = mediaTotals(grids, termsOf(next));
      if (next.billingType) billingPlan(next.billingType, totals, next.negotiatedCommission != null);
    } catch (error) {
      if (error instanceof MediaMathError) throw new BadRequestException(error.message);
      throw error;
    }

    await this.medias.updateHeader(id, changes, userId, diffFields(media, changes, HISTORY_FIELDS), clearGrids);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  async act(userId: string, access: UserPermissions, id: string, action: 'complete' | 'cancel' | 'reopen'): Promise<MediaView> {
    const media = await this.requireViewable(userId, access, id);
    if (!canActOnMedia(userId, access, media)) throw new ForbiddenException('Sem permissão para alterar esta mídia.');
    const next = nextMediaSituation(media.situation, action);
    if (!next) throw new BadRequestException('A mídia já está nesta situação.');
    if (next === 'OPEN') {
      const project = await this.projects.getProject(media.projectId);
      if (project?.situation !== 'OPEN') throw new BadRequestException('Reabra o projeto antes de reabrir a mídia.');
    }
    if (next === 'CANCELED' && media.sentToFinanceAt) {
      throw new BadRequestException('A mídia foi enviada ao financeiro: reabra as faturas antes de cancelar.');
    }
    await this.medias.changeSituation(id, next, userId);
    return this.get(userId, access, id);
  }

  async addMembers(userId: string, access: UserPermissions, id: string, userIds: string[]): Promise<MediaView> {
    await this.requireEditable(userId, access, id);
    const unique = [...new Set(userIds)];
    const users = await this.auth.getUsers(unique);
    if (users.length !== unique.length || users.some((user) => !user.active)) {
      throw new BadRequestException('Usuário não encontrado ou inativo.');
    }
    await this.medias.addMembers(id, unique);
    return this.get(userId, access, id);
  }

  async removeMember(userId: string, access: UserPermissions, id: string, memberId: string): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    if (media.responsibleId === memberId) throw new BadRequestException('O responsável não pode sair dos envolvidos.');
    await this.medias.removeMember(id, memberId);
    return this.get(userId, access, id);
  }

  async history(userId: string, access: UserPermissions, id: string) {
    await this.requireViewable(userId, access, id);
    return this.medias.listHistory(id);
  }

  // ---------- Peças ----------

  async addPiece(userId: string, access: UserPermissions, id: string, title: string): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    const clean = title.trim();
    if (!clean) throw new BadRequestException('Informe o título da peça.');
    await this.medias.createPiece(id, nextPieceLetter(media.pieces.map((piece) => piece.letter)), clean);
    return this.get(userId, access, id);
  }

  async renamePiece(userId: string, access: UserPermissions, id: string, pieceId: string, title: string): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    this.requirePiece(media, pieceId);
    if (!title.trim()) throw new BadRequestException('Informe o título da peça.');
    await this.medias.updatePiece(pieceId, title.trim());
    return this.get(userId, access, id);
  }

  /** Peça em uso numa grade não sai. */
  async removePiece(userId: string, access: UserPermissions, id: string, pieceId: string): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    this.requirePiece(media, pieceId);
    if (await this.medias.pieceInUse(pieceId)) {
      throw new BadRequestException('A peça está em uso numa grade: tire-a das linhas antes.');
    }
    await this.medias.deletePiece(pieceId);
    return this.get(userId, access, id);
  }

  // ---------- Grades ----------

  async addGrid(userId: string, access: UserPermissions, id: string, input: GridInput): Promise<MediaView> {
    await this.requireEditable(userId, access, id);
    await this.medias.createGrid(id, await this.gridData(input));
    return this.get(userId, access, id);
  }

  async updateGrid(userId: string, access: UserPermissions, id: string, gridId: string, input: GridInput): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    const grid = this.requireGrid(media, gridId);
    const data = await this.gridData({
      marketId: input.marketId === undefined ? grid.marketId : input.marketId,
      periodStart: input.periodStart === undefined ? dateKey(grid.periodStart) : input.periodStart,
      periodEnd: input.periodEnd === undefined ? dateKey(grid.periodEnd) : input.periodEnd,
    });
    // As inserções por dia precisam continuar dentro do novo período.
    for (const line of grid.lines) {
      if (line.dailyInsertions) await this.lineData(media, data, toLineInput(line));
    }
    await this.medias.updateGrid(gridId, data);
    return this.get(userId, access, id);
  }

  async removeGrid(userId: string, access: UserPermissions, id: string, gridId: string): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    this.requireGrid(media, gridId);
    await this.medias.deleteGrid(gridId);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  /** Duplica a grade para outra praça (período obrigatório). */
  async duplicateGrid(userId: string, access: UserPermissions, id: string, gridId: string, input: GridInput): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    const grid = this.requireGrid(media, gridId);
    const data = await this.gridData({
      marketId: input.marketId === undefined ? grid.marketId : input.marketId,
      periodStart: input.periodStart === undefined ? dateKey(grid.periodStart) : input.periodStart,
      periodEnd: input.periodEnd === undefined ? dateKey(grid.periodEnd) : input.periodEnd,
    });
    if (!data.periodStart || !data.periodEnd) throw new BadRequestException('Informe o período para duplicar a grade.');
    await this.medias.duplicateGrid(gridId, data);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  // ---------- Linhas ----------

  async addLine(userId: string, access: UserPermissions, id: string, gridId: string, input: LineInput): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    const grid = this.requireGrid(media, gridId);
    await this.medias.createLine(gridId, await this.lineData(media, grid, input));
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  async updateLine(userId: string, access: UserPermissions, id: string, lineId: string, input: LineInput): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    const grid = media.grids.find((item) => item.lines.some((line) => line.id === lineId));
    const line = grid?.lines.find((item) => item.id === lineId);
    if (!grid || !line) throw new NotFoundException('Linha não encontrada.');
    await this.medias.updateLine(lineId, await this.lineData(media, grid, { ...toLineInput(line), ...input }));
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  async removeLine(userId: string, access: UserPermissions, id: string, lineId: string): Promise<MediaView> {
    const media = await this.requireEditable(userId, access, id);
    if (!media.grids.some((grid) => grid.lines.some((line) => line.id === lineId))) {
      throw new NotFoundException('Linha não encontrada.');
    }
    await this.medias.deleteLine(lineId);
    await this.recalculate(id);
    return this.get(userId, access, id);
  }

  // ---------- Apoio ----------

  async requireViewable(userId: string, access: UserPermissions, id: string): Promise<MediaDetail> {
    const media = await this.medias.findById(id);
    if (!media || !canViewMedia(userId, access, media)) throw new NotFoundException('Mídia não encontrada.');
    return media;
  }

  private async requireEditable(userId: string, access: UserPermissions, id: string): Promise<MediaDetail> {
    const media = await this.requireViewable(userId, access, id);
    if (!canEditMedia(userId, access, media)) {
      throw new ForbiddenException(
        media.sentToFinanceAt
          ? 'A mídia foi enviada ao financeiro e está travada.'
          : media.situation !== 'OPEN'
            ? 'A mídia está fechada: reabra para alterar.'
            : 'Sem permissão para alterar esta mídia.',
      );
    }
    return media;
  }

  private requirePiece(media: MediaDetail, pieceId: string): PieceRecord {
    const piece = media.pieces.find((item) => item.id === pieceId);
    if (!piece) throw new NotFoundException('Peça não encontrada.');
    return piece;
  }

  private requireGrid(media: MediaDetail, gridId: string): GridRecord {
    const grid = media.grids.find((item) => item.id === gridId);
    if (!grid) throw new NotFoundException('Grade não encontrada.');
    return grid;
  }

  private async requireVehicle(vehicleId: string): Promise<void> {
    const vehicle = await this.crm.getParty(vehicleId);
    if (!vehicle || !vehicle.active || !vehicle.roles.includes('vehicle')) {
      throw new BadRequestException('Veículo não encontrado ou inativo.');
    }
  }

  private async requireActiveUser(userId: string): Promise<void> {
    const [user] = await this.auth.getUsers([userId]);
    if (!user || !user.active) throw new BadRequestException('Responsável não encontrado ou inativo.');
  }

  private async requireStatus(statusId: string): Promise<void> {
    const status = await this.catalog.findStatus(statusId);
    if (!status || !status.active) throw new BadRequestException('Status de mídia não encontrado.');
  }

  private async parseDeadline(value: string | null | undefined): Promise<Date | null> {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Prazo inválido.');
    const { timezone } = await this.settings.getAgency();
    return endOfLocalDay(value, timezone);
  }

  private async gridData(input: GridInput) {
    const periodStart = toDateOnly(input.periodStart) ?? null;
    const periodEnd = toDateOnly(input.periodEnd) ?? null;
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new BadRequestException('O fim do período é antes do início.');
    }
    const marketId = input.marketId ?? null;
    if (marketId && !(await this.catalog.findMarket(marketId))) throw new BadRequestException('Praça não encontrada.');
    return { marketId, periodStart, periodEnd };
  }

  /**
   * Monta a linha conforme o tipo de mídia: TV e rádio somam o calendário de
   * inserções (só nos dias do programa); externa pode contar bi-semanas.
   */
  private async lineData(media: MediaDetail, grid: Pick<GridRecord, 'periodStart' | 'periodEnd'>, input: LineInput): Promise<LineData> {
    const pieceId = input.pieceId ?? null;
    if (pieceId && !media.pieces.some((piece) => piece.id === pieceId)) {
      throw new BadRequestException('A peça não é desta mídia.');
    }
    const costMetricId = input.costMetricId ?? null;
    if (costMetricId && !(await this.catalog.findCostMetric(costMetricId))) {
      throw new BadRequestException('Métrica de custo não encontrada.');
    }
    const startDate = toDateOnly(input.startDate) ?? null;
    const endDate = toDateOnly(input.endDate) ?? null;
    if (startDate && endDate && startDate > endDate) throw new BadRequestException('O fim é antes do início.');

    let insertions = input.insertions ?? 0;
    let programId = input.programId ?? null;
    let dailyInsertions = input.dailyInsertions ?? null;
    let biweeks = input.biweeks ?? null;
    try {
      if (media.mediaType === 'TV' || media.mediaType === 'RADIO') {
        if (!programId) throw new MediaMathError('Escolha o programa antes de marcar as inserções.');
        const program = await this.catalog.findProgram(programId);
        if (!program || program.mediaType !== media.mediaType) throw new MediaMathError('Programa não encontrado.');
        insertions = dailyInsertionsQuantity(dailyInsertions ?? {}, program.airingDays, {
          start: dateKey(grid.periodStart),
          end: dateKey(grid.periodEnd),
        });
        dailyInsertions = Object.fromEntries(Object.entries(dailyInsertions ?? {}).filter(([, count]) => count > 0));
      } else {
        programId = null;
        dailyInsertions = null;
        if (media.mediaType === 'OOH' && biweeks?.length) insertions = biweeksQuantity(biweeks);
        else biweeks = null;
      }
      if (!Number.isInteger(insertions) || insertions < 0) throw new MediaMathError('Quantidade inválida.');
      const values = {
        quantity: insertions,
        unitValue: input.unitValue ?? 0,
        discountType: input.discountType ?? 'PERCENT',
        discountValue: input.discountValue ?? 0,
        isBonus: input.isBonus ?? false,
      };
      return {
        pieceId,
        programId,
        product: input.product?.trim() || null,
        location: input.location?.trim() || null,
        section: input.section?.trim() || null,
        position: input.position?.trim() || null,
        color: input.color?.trim() || null,
        format: input.format?.trim() || null,
        placementType: input.placementType?.trim() || null,
        costMetricId,
        startDate,
        endDate,
        biweeks,
        dailyInsertions,
        insertions,
        unitValue: values.unitValue,
        discountType: values.discountType,
        discountValue: values.discountValue,
        subtotal: lineSubtotal(values),
        isBonus: values.isBonus,
      };
    } catch (error) {
      if (error instanceof MediaMathError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** Recalcula e grava os totais (para as pautas e relatórios). */
  private async recalculate(id: string): Promise<void> {
    const media = await this.medias.findById(id);
    if (!media) return;
    const grids = media.grids.map((grid) => gridTotals(grid.lines.map(toLineValues)));
    try {
      const totals = mediaTotals(grids, termsOf(media));
      await this.medias.saveTotals(id, { grossTotal: totals.total, bonusTotal: totals.bonusTotal, netValue: totals.net });
    } catch (error) {
      if (!(error instanceof MediaMathError)) throw error;
      // Ex.: a comissão em valor ficou maior que o total depois de tirar linhas.
      const gross = grids.reduce((sum, grid) => sum + grid.total, 0);
      await this.medias.saveTotals(id, { grossTotal: gross, bonusTotal: 0, netValue: 0 });
    }
  }

  private async names(medias: MediaRecord[]) {
    const partyIds = medias.flatMap((media) => [media.clientId, media.vehicleId]).filter((id): id is string => Boolean(id));
    const contactIds = medias.map((media) => media.vehicleContactId).filter((id): id is string => Boolean(id));
    const userIds = medias.flatMap((media) => [media.responsibleId, media.requesterId, ...media.memberIds]).filter(
      (id): id is string => Boolean(id),
    );
    const [parties, contacts, users, projects] = await Promise.all([
      this.crm.getParties(partyIds),
      this.crm.getContacts(contactIds),
      this.auth.getUsers([...new Set(userIds)]),
      this.projects.getProjects(medias.map((media) => media.projectId)),
    ]);
    const partyMap = new Map(parties.map((party) => [party.id, { id: party.id, name: party.name }]));
    const contactMap = new Map(contacts.map((contact) => [contact.id, { id: contact.id, name: contact.name }]));
    const userMap = new Map(users.map((user) => [user.id, { id: user.id, name: user.name, color: user.color }]));
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    return {
      party: (id: string | null) => (id ? (partyMap.get(id) ?? null) : null),
      contact: (id: string | null) => (id ? (contactMap.get(id) ?? null) : null),
      user: (id: string | null) => (id ? (userMap.get(id) ?? null) : null),
      project: (id: string) => projectMap.get(id) ?? null,
    };
  }

  private toListView(media: MediaRecord, names: Awaited<ReturnType<MediasService['names']>>, now: Date): MediaListView {
    const project = names.project(media.projectId);
    return {
      id: media.id,
      number: project ? `${project.number}.${media.sequence}` : String(media.sequence),
      title: media.title,
      mediaType: media.mediaType,
      client: names.party(media.clientId),
      vehicle: names.party(media.vehicleId),
      project: project ? { id: project.id, number: project.number, title: project.title } : null,
      responsible: names.user(media.responsibleId),
      statusId: media.statusId,
      situation: media.situation,
      deadline: media.deadline,
      overdue:
        media.situation === 'OPEN' && !media.statusIgnoresDelay && media.deadline !== null && media.deadline < now,
      grossTotal: media.grossTotal,
      netValue: media.netValue,
      sentToFinanceAt: media.sentToFinanceAt,
      createdAt: media.createdAt,
    };
  }
}

/** O desconto do cabeçalho é o desconto geral da mídia. */
function termsOf(media: MediaHeader): MediaTerms {
  return {
    generalDiscountType: media.discountType,
    generalDiscountValue: media.discountValue,
    commissionType: media.commissionType,
    commissionValue: media.commissionValue,
    negotiatedCommission: media.negotiatedCommission,
    feeType: media.feeType,
    feeValue: media.feeValue,
  };
}

function toLineValues(line: LineData) {
  return {
    quantity: line.insertions,
    unitValue: line.unitValue,
    discountType: line.discountType,
    discountValue: line.discountValue,
    isBonus: line.isBonus,
  };
}

function toLineInput(line: LineData): LineInput {
  return {
    ...line,
    startDate: dateKey(line.startDate),
    endDate: dateKey(line.endDate),
  };
}
