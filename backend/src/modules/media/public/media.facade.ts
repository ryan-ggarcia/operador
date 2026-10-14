/** Token de injeção da fachada do módulo media. */
export const MEDIA_FACADE = Symbol('MEDIA_FACADE');

export interface MediaSummary {
  count: number;
  open: number;
  /** Soma do valor total das mídias não canceladas. */
  grossTotal: number;
  netValue: number;
}

/** Interface pública do módulo media. */
export interface MediaFacade {
  getSummaryByProject(projectId: string): Promise<MediaSummary>;
  getSummaryByClient(clientId: string): Promise<MediaSummary>;
}
