import type { HttpClient } from './http';
import type { NamedRef, Page, UserRef } from './types';

export type MediaType = 'TV' | 'RADIO' | 'NEWSPAPER' | 'MAGAZINE' | 'OOH' | 'INTERNET' | 'OTHER';
export type MediaSituation = 'OPEN' | 'DONE' | 'CANCELED';
export type ValueType = 'PERCENT' | 'AMOUNT';
export type BillingType = 'FLCC' | 'FBCC' | 'FLCA' | 'FL_CCA' | 'FBCA';

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  TV: 'TV',
  RADIO: 'Rádio',
  NEWSPAPER: 'Jornal',
  MAGAZINE: 'Revista',
  OOH: 'Externa',
  INTERNET: 'Internet',
  OTHER: 'Outras',
};

export interface MediaListItem {
  id: string;
  number: string;
  title: string;
  mediaType: MediaType;
  client: NamedRef | null;
  vehicle: NamedRef | null;
  project: { id: string; number: number; title: string } | null;
  responsible: UserRef | null;
  statusId: string | null;
  situation: MediaSituation;
  deadline: string | null;
  overdue: boolean;
  grossTotal: number;
  netValue: number;
  sentToFinanceAt: string | null;
  createdAt: string;
}

export interface MediaLine {
  id: string;
  gridId: string;
  order: number;
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
  startDate: string | null;
  endDate: string | null;
  biweeks: number[] | null;
  dailyInsertions: Record<string, number> | null;
  insertions: number;
  unitValue: number;
  discountType: ValueType;
  discountValue: number;
  subtotal: number;
  isBonus: boolean;
}

export interface MediaGrid {
  id: string;
  marketId: string | null;
  marketName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  order: number;
  lines: MediaLine[];
  totals: { gross: number; discount: number; bonus: number; total: number; insertions: number };
}

export interface MediaTotals {
  gridsTotal: number;
  bonusTotal: number;
  generalDiscount: number;
  total: number;
  commission: number;
  net: number;
  partial: number;
  fee: number;
}

export interface PlannedInvoice {
  invoiceClass: string;
  payer: 'client' | 'agency' | 'thirdParty';
  payee: 'client' | 'agency' | 'thirdParty';
  amount: number;
  kind: 'REVENUE' | 'EXPENSE' | null;
}

export interface Media extends MediaListItem {
  vehicleContact: NamedRef | null;
  requester: UserRef | null;
  members: UserRef[];
  networkId: string | null;
  channel: string | null;
  target: string | null;
  estimateNumber: string | null;
  documentDate: string | null;
  commissionType: ValueType;
  commissionValue: number;
  negotiatedCommission: number | null;
  feeType: ValueType;
  feeValue: number;
  discountType: ValueType;
  discountValue: number;
  billingType: BillingType | null;
  firstDueDate: string | null;
  paymentCondition: string | null;
  vehicleNotes: string | null;
  clientNotes: string | null;
  briefing: string | null;
  pieces: { id: string; letter: string; title: string }[];
  grids: MediaGrid[];
  totals: MediaTotals | null;
  invoices: PlannedInvoice[];
  warnings: string[];
  /** Faturas criadas no financeiro (depois do envio). */
  bills: {
    id: string;
    kind: 'REVENUE' | 'EXPENSE';
    title: string;
    amount: number;
    dueDate: string;
    situation: 'OPEN' | 'PAID' | 'CANCELED';
  }[];
  updatedAt: string;
  can: { edit: boolean; act: boolean };
}

export interface MediaQuery {
  search?: string;
  mediaTypes?: MediaType[];
  situations?: MediaSituation[];
  mine?: boolean;
  limit?: number;
  offset?: number;
}

/** Campos do cabeçalho (datas em AAAA-MM-DD). */
export type MediaHeaderInput = Partial<
  Pick<
    Media,
    | 'title'
    | 'networkId'
    | 'channel'
    | 'target'
    | 'estimateNumber'
    | 'documentDate'
    | 'commissionType'
    | 'commissionValue'
    | 'negotiatedCommission'
    | 'feeType'
    | 'feeValue'
    | 'discountType'
    | 'discountValue'
    | 'billingType'
    | 'firstDueDate'
    | 'paymentCondition'
    | 'vehicleNotes'
    | 'clientNotes'
    | 'briefing'
    | 'statusId'
    | 'deadline'
  > & { vehicleId: string | null; vehicleContactId: string | null; responsibleId: string | null }
>;

export type LineInput = Partial<Omit<MediaLine, 'id' | 'gridId' | 'order' | 'subtotal'>>;

export interface Network {
  id: string;
  name: string;
  mnemonic: string;
  type: 'OPEN_TV' | 'PAY_TV' | 'RADIO' | 'OTHER';
  active: boolean;
}

export interface Market {
  id: string;
  name: string;
  abbreviation: string | null;
  state: string | null;
  active: boolean;
}

export interface Program {
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

export interface MediaStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  active: boolean;
  ignoresDelay: boolean;
}

export class MediaService {
  constructor(private readonly http: HttpClient) {}

  list(query: MediaQuery = {}) {
    return this.http.get<Page<MediaListItem>>('/medias', { ...query });
  }
  get(id: string) {
    return this.http.get<Media>(`/medias/${id}`);
  }
  create(input: {
    title: string;
    clientId: string;
    mediaType: MediaType;
    projectId?: string | null;
    vehicleId?: string | null;
    responsibleId?: string | null;
    deadline?: string | null;
  }) {
    return this.http.post<Media>('/medias', input);
  }
  update(id: string, input: MediaHeaderInput, confirmClearGrids = false) {
    return this.http.patch<Media>(`/medias/${id}`, confirmClearGrids ? { ...input, confirmClearGrids } : input);
  }
  act(id: string, action: 'complete' | 'cancel' | 'reopen') {
    return this.http.post<Media>(`/medias/${id}/${action}`);
  }
  sendToFinance(id: string) {
    return this.http.post<Media>(`/medias/${id}/send-to-finance`);
  }
  reopenBilling(id: string) {
    return this.http.post<Media>(`/medias/${id}/reopen-billing`);
  }
  addPiece(id: string, title: string) {
    return this.http.post<Media>(`/medias/${id}/pieces`, { title });
  }
  removePiece(id: string, pieceId: string) {
    return this.http.delete<Media>(`/medias/${id}/pieces/${pieceId}`);
  }
  addGrid(id: string, input: { marketId?: string | null; periodStart?: string | null; periodEnd?: string | null }) {
    return this.http.post<Media>(`/medias/${id}/grids`, input);
  }
  updateGrid(
    id: string,
    gridId: string,
    input: { marketId?: string | null; periodStart?: string | null; periodEnd?: string | null },
  ) {
    return this.http.patch<Media>(`/medias/${id}/grids/${gridId}`, input);
  }
  removeGrid(id: string, gridId: string) {
    return this.http.delete<Media>(`/medias/${id}/grids/${gridId}`);
  }
  duplicateGrid(
    id: string,
    gridId: string,
    input: { marketId?: string | null; periodStart?: string | null; periodEnd?: string | null },
  ) {
    return this.http.post<Media>(`/medias/${id}/grids/${gridId}/duplicate`, input);
  }
  addLine(id: string, gridId: string, input: LineInput) {
    return this.http.post<Media>(`/medias/${id}/grids/${gridId}/lines`, input);
  }
  updateLine(id: string, lineId: string, input: LineInput) {
    return this.http.patch<Media>(`/medias/${id}/lines/${lineId}`, input);
  }
  removeLine(id: string, lineId: string) {
    return this.http.delete<Media>(`/medias/${id}/lines/${lineId}`);
  }

  networks() {
    return this.http.get<Network[]>('/media-settings/networks');
  }
  saveNetwork(id: string | null, input: Omit<Network, 'id'>) {
    return id
      ? this.http.patch<Network>(`/media-settings/networks/${id}`, input)
      : this.http.post<Network>('/media-settings/networks', input);
  }
  markets() {
    return this.http.get<Market[]>('/media-settings/markets');
  }
  saveMarket(id: string | null, input: Omit<Market, 'id'>) {
    return id
      ? this.http.patch<Market>(`/media-settings/markets/${id}`, input)
      : this.http.post<Market>('/media-settings/markets', input);
  }
  programs(query: { mediaType?: 'TV' | 'RADIO'; networkId?: string } = {}) {
    return this.http.get<Program[]>('/media-settings/programs', query);
  }
  saveProgram(id: string | null, input: Omit<Program, 'id'>) {
    return id
      ? this.http.patch<Program>(`/media-settings/programs/${id}`, input)
      : this.http.post<Program>('/media-settings/programs', input);
  }
  costMetrics() {
    return this.http.get<{ id: string; name: string; active: boolean }[]>('/media-settings/cost-metrics');
  }
  statuses() {
    return this.http.get<MediaStatus[]>('/media-settings/statuses');
  }
}
