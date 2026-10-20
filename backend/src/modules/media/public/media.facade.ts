import type { UserPermissions } from '../../auth/public/index.js';

/** Token de injeção da fachada do módulo media. */
export const MEDIA_FACADE = Symbol('MEDIA_FACADE');

export interface MediaSummary {
  count: number;
  open: number;
  /** Soma do valor total das mídias não canceladas. */
  grossTotal: number;
  netValue: number;
}

/** Busca de mídias com as regras da pauta (assistente de IA). */
export interface MediaSearchQuery {
  /** Título ou número da estimativa. */
  search?: string;
  clientId?: string;
  projectId?: string;
  situations?: ('OPEN' | 'DONE' | 'CANCELED')[];
  /** Criadas no período (AAAA-MM-DD, inclusivo, no fuso da agência). */
  createdFrom?: string;
  createdTo?: string;
}

export interface MediaBrief {
  id: string;
  number: string;
  title: string;
  mediaType: string;
  client: string | null;
  vehicle: string | null;
  project: { number: number; title: string } | null;
  responsible: string | null;
  situation: 'OPEN' | 'DONE' | 'CANCELED';
  deadline: Date | null;
  grossTotal: number;
  netValue: number;
  sentToFinance: boolean;
  createdAt: Date;
}

export interface MediaSearchResult {
  total: number;
  /** As 20 mais recentes. */
  items: MediaBrief[];
  /** Soma das não canceladas entre as 200 mais recentes. */
  totals: { grossTotal: number; netValue: number; counted: number };
  /** Mais de 200 resultados: os totais não cobrem todos. */
  partial: boolean;
}

/** Interface pública do módulo media. */
export interface MediaFacade {
  /** Mídias que o usuário vê na pauta (sem acesso a mídias: 403). */
  searchMediasForUser(userId: string, access: UserPermissions, query: MediaSearchQuery): Promise<MediaSearchResult>;
  getSummaryByProject(projectId: string): Promise<MediaSummary>;
  getSummaryByClient(clientId: string): Promise<MediaSummary>;
}
