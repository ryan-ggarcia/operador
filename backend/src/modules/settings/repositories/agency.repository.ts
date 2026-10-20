import type { Agency } from '../public/settings.facade.js';

export const AGENCY_REPOSITORY = Symbol('AGENCY_REPOSITORY');

/** A agência é uma linha só (schema "settings"). */
export interface AgencyRepository {
  find(): Promise<Agency | null>;
  save(data: Agency): Promise<Agency>;
}
