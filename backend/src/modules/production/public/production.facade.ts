/** Token de injeção da fachada do módulo production. */
export const PRODUCTION_FACADE = Symbol('PRODUCTION_FACADE');

export interface ProductionSummary {
  count: number;
  open: number;
  /** Soma dos pedidos (cotações aprovadas) das produções não canceladas. */
  totalValue: number;
  commissionTotal: number;
}

/** Interface pública do módulo production. */
export interface ProductionFacade {
  getSummaryByProject(projectId: string): Promise<ProductionSummary>;
  getSummaryByClient(clientId: string): Promise<ProductionSummary>;
}
