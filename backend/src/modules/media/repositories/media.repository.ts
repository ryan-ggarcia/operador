import type { FieldChange } from '../../../shared/history/diff.js';
import type { ValueType } from '../../../shared/money/money.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { BillingType } from '../domain/media-math.js';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');
export const MEDIA_CATALOG_REPOSITORY = Symbol('MEDIA_CATALOG_REPOSITORY');

export type MediaType = 'TV' | 'RADIO' | 'NEWSPAPER' | 'MAGAZINE' | 'OOH' | 'INTERNET' | 'OTHER';
export type MediaSituation = 'OPEN' | 'DONE' | 'CANCELED';

/** Campos do cabeçalho da mídia que se editam. */
export interface MediaHeader {
  title: string;
  vehicleId: string | null;
  vehicleContactId: string | null;
  networkId: string | null;
  channel: string | null;
  target: string | null;
  estimateNumber: string | null;
  responsibleId: string | null;
  statusId: string | null;
  deadline: Date | null;
  documentDate: Date | null;
  commissionType: ValueType;
  commissionValue: number;
  negotiatedCommission: number | null;
  feeType: ValueType;
  feeValue: number;
  discountType: ValueType;
  discountValue: number;
  billingType: BillingType | null;
  firstDueDate: Date | null;
  paymentCondition: string | null;
  vehicleNotes: string | null;
  clientNotes: string | null;
  briefing: string | null;
}

export interface MediaRecord extends MediaHeader {
  id: string;
  projectId: string;
  sequence: number;
  clientId: string;
  mediaType: MediaType;
  requesterId: string | null;
  situation: MediaSituation;
  statusIgnoresDelay: boolean;
  grossTotal: number;
  bonusTotal: number;
  netValue: number;
  sentToFinanceAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberIds: string[];
}

export interface PieceRecord {
  id: string;
  letter: string;
  title: string;
}

export interface LineData {
  pieceId: string | null;
  programId: string | null;
  product: string | null;
  location: string | null;
  section: string | null;
  position: string | null;
  color: string | null;
  format: string | null;
  placementType: string | null;
  costMetricId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  biweeks: number[] | null;
  dailyInsertions: Record<string, number> | null;
  insertions: number;
  unitValue: number;
  discountType: ValueType;
  discountValue: number;
  subtotal: number;
  isBonus: boolean;
}

export interface LineRecord extends LineData {
  id: string;
  gridId: string;
  order: number;
}

export interface GridData {
  marketId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export interface GridRecord extends GridData {
  id: string;
  marketName: string | null;
  order: number;
  lines: LineRecord[];
}

export interface MediaDetail extends MediaRecord {
  pieces: PieceRecord[];
  grids: GridRecord[];
}

export interface MediaVisibility {
  userId: string;
  readAll: boolean;
  /** Projetos ocultos cujas mídias o usuário só vê se envolvido nelas. */
  hiddenProjectIds: string[];
}

export interface MediaFilter {
  visibility: MediaVisibility;
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

export interface NewMedia {
  projectId: string;
  sequence: number;
  clientId: string;
  title: string;
  mediaType: MediaType;
  vehicleId: string | null;
  responsibleId: string | null;
  requesterId: string;
  statusId: string | null;
  deadline: Date | null;
  briefing: string | null;
  commissionValue: number;
}

export interface SavedTotals {
  grossTotal: number;
  bonusTotal: number;
  netValue: number;
}

/** Mídias, peças, grades e linhas (schema "media"). */
export interface MediaRepository {
  list(filter: MediaFilter): Promise<Page<MediaRecord>>;
  findById(id: string): Promise<MediaDetail | null>;
  create(data: NewMedia, actorId: string): Promise<MediaRecord>;
  /** Grava o cabeçalho e o histórico; com clearGrids, apaga as grades (troca de veículo). */
  updateHeader(
    id: string,
    changes: Partial<MediaHeader>,
    actorId: string,
    history: FieldChange[],
    clearGrids: boolean,
  ): Promise<void>;
  saveTotals(id: string, totals: SavedTotals): Promise<void>;
  /** Marca (ou desmarca, com null) o envio ao financeiro, com o retrato dos dados. */
  setSentToFinance(id: string, at: Date | null, snapshot: unknown, actorId: string): Promise<void>;
  changeSituation(id: string, situation: MediaSituation, actorId: string): Promise<void>;
  /** Fecha as mídias abertas do projeto (arquivar conclui, cancelar cancela). */
  closeByProject(projectId: string, situation: 'DONE' | 'CANCELED', actorId: string): Promise<number>;
  /** Contagem e somas por projeto ou cliente (sem as canceladas nos valores). */
  summarize(filter: { projectId?: string; clientId?: string }): Promise<{
    count: number;
    open: number;
    grossTotal: number;
    netValue: number;
  }>;
  addMembers(id: string, userIds: string[]): Promise<void>;
  removeMember(id: string, userId: string): Promise<void>;
  listHistory(id: string): Promise<
    { id: string; userId: string | null; action: string; field: string | null; oldValue: string | null; newValue: string | null; createdAt: Date }[]
  >;

  createPiece(mediaId: string, letter: string, title: string): Promise<PieceRecord>;
  updatePiece(id: string, title: string): Promise<PieceRecord>;
  deletePiece(id: string): Promise<void>;
  pieceInUse(id: string): Promise<boolean>;

  createGrid(mediaId: string, data: GridData): Promise<GridRecord>;
  updateGrid(id: string, data: Partial<GridData>): Promise<void>;
  deleteGrid(id: string): Promise<void>;
  /** Copia a grade (com as linhas) para outra praça. */
  duplicateGrid(id: string, data: GridData): Promise<GridRecord>;

  createLine(gridId: string, data: LineData): Promise<LineRecord>;
  updateLine(id: string, data: LineData): Promise<LineRecord>;
  deleteLine(id: string): Promise<void>;
}

export interface NetworkRecord {
  id: string;
  name: string;
  mnemonic: string;
  type: 'OPEN_TV' | 'PAY_TV' | 'RADIO' | 'OTHER';
  active: boolean;
}

export interface MarketRecord {
  id: string;
  name: string;
  abbreviation: string | null;
  state: string | null;
  active: boolean;
}

export interface ProgramRecord {
  id: string;
  name: string;
  mnemonic: string;
  networkId: string;
  channel: string | null;
  mediaType: MediaType;
  airingDays: number[];
  startTime: string | null;
  endTime: string | null;
  active: boolean;
}

export interface StatusRecord {
  id: string;
  name: string;
  color: string;
  order: number;
  active: boolean;
  ignoresDelay: boolean;
}

export interface NamedItem {
  id: string;
  name: string;
  active: boolean;
}

/** Cadastros de apoio da mídia (schema "media"). */
export interface MediaCatalogRepository {
  listNetworks(): Promise<NetworkRecord[]>;
  findNetwork(id: string): Promise<NetworkRecord | null>;
  networkMnemonicInUse(mnemonic: string, exceptId?: string): Promise<boolean>;
  networkInUse(id: string): Promise<boolean>;
  saveNetwork(id: string | null, data: Omit<NetworkRecord, 'id'>): Promise<NetworkRecord>;

  listMarkets(): Promise<MarketRecord[]>;
  findMarket(id: string): Promise<MarketRecord | null>;
  saveMarket(id: string | null, data: Omit<MarketRecord, 'id'>): Promise<MarketRecord>;

  listPrograms(filter: { networkId?: string; mediaType?: MediaType }): Promise<ProgramRecord[]>;
  findProgram(id: string): Promise<ProgramRecord | null>;
  programMnemonicInUse(networkId: string, mnemonic: string, exceptId?: string): Promise<boolean>;
  saveProgram(id: string | null, data: Omit<ProgramRecord, 'id'>): Promise<ProgramRecord>;

  listCostMetrics(): Promise<NamedItem[]>;
  findCostMetric(id: string): Promise<NamedItem | null>;
  saveCostMetric(id: string | null, data: { name: string; active: boolean }): Promise<NamedItem>;

  listStatuses(includeInactive: boolean): Promise<StatusRecord[]>;
  findStatus(id: string): Promise<StatusRecord | null>;
  saveStatus(id: string | null, data: Omit<StatusRecord, 'id' | 'order'> & { order?: number }): Promise<StatusRecord>;
}
