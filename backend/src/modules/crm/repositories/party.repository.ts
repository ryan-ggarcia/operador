import type { Page } from '../../../shared/validation/pagination.js';
import type { FieldChange } from '../../../shared/history/diff.js';
import type { PartyRole } from '../public/crm.facade.js';

export const PARTY_REPOSITORY = Symbol('PARTY_REPOSITORY');

export interface PartyRecord {
  id: string;
  name: string;
  document: string | null;
  isClient: boolean;
  isSupplier: boolean;
  isProvider: boolean;
  isVehicle: boolean;
  active: boolean;
}

/** Campos editáveis da pessoa. */
export interface PartyData {
  personType: 'PF' | 'PJ';
  name: string;
  legalName: string | null;
  document: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone1: string | null;
  phone2: string | null;
  website: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  isClient: boolean;
  isSupplier: boolean;
  isProvider: boolean;
  isVehicle: boolean;
  clientGroupId: string | null;
  bankData: unknown;
  notes: string | null;
}

export interface PartyDetail extends PartyData {
  id: string;
  clientGroupName: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartyListItem extends PartyRecord {
  personType: 'PF' | 'PJ';
  legalName: string | null;
  email: string | null;
  phone1: string | null;
  city: string | null;
  state: string | null;
  clientGroupId: string | null;
  clientGroupName: string | null;
}

export interface PartyFilter {
  /** A pessoa precisa ter pelo menos um destes papéis. */
  roles: PartyRole[];
  search?: string;
  active?: boolean;
  clientGroupId?: string;
  limit: number;
  offset: number;
}

/** Pessoas do crm (schema "crm"). */
export interface PartyRepository {
  findByIds(ids: string[]): Promise<PartyRecord[]>;
  search(filter: PartyFilter): Promise<Page<PartyListItem>>;
  findDetail(id: string): Promise<PartyDetail | null>;
  findByDocument(document: string): Promise<PartyRecord | null>;
  clientGroupExists(id: string): Promise<boolean>;
  create(data: PartyData, actorId: string): Promise<PartyDetail>;
  /** Grava a alteração e as mudanças no histórico, juntas. */
  update(
    id: string,
    data: Partial<PartyData> & { active?: boolean },
    actorId: string,
    changes: FieldChange[],
  ): Promise<PartyDetail>;
}
