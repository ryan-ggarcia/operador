/** Token de injeção da fachada do módulo crm. */
export const CRM_FACADE = Symbol('CRM_FACADE');

export type PartyRole = 'client' | 'supplier' | 'provider' | 'vehicle';

export interface PartySummary {
  id: string;
  name: string;
  document: string | null;
  roles: PartyRole[];
  active: boolean;
}

/** Interface pública do módulo crm. */
export interface CrmFacade {
  getParties(ids: string[]): Promise<PartySummary[]>;
  getParty(id: string): Promise<PartySummary | null>;
}
