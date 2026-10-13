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

export interface PartyRepository {
  findByIds(ids: string[]): Promise<PartyRecord[]>;
}
