import { Inject, Injectable } from '@nestjs/common';
import type {
  CrmFacade,
  PartyRole,
  PartySummary,
} from './public/crm.facade.js';
import {
  PARTY_REPOSITORY,
  type PartyRecord,
  type PartyRepository,
} from './repositories/party.repository.js';

export function toPartySummary(party: PartyRecord): PartySummary {
  const roles: PartyRole[] = [];
  if (party.isClient) roles.push('client');
  if (party.isSupplier) roles.push('supplier');
  if (party.isProvider) roles.push('provider');
  if (party.isVehicle) roles.push('vehicle');
  return {
    id: party.id,
    name: party.name,
    document: party.document,
    roles,
    active: party.active,
  };
}

@Injectable()
export class CrmFacadeService implements CrmFacade {
  constructor(
    @Inject(PARTY_REPOSITORY) private readonly parties: PartyRepository,
  ) {}

  async getParties(ids: string[]): Promise<PartySummary[]> {
    if (ids.length === 0) return [];
    const unique = [...new Set(ids)];
    return (await this.parties.findByIds(unique)).map(toPartySummary);
  }

  async getParty(id: string): Promise<PartySummary | null> {
    const [party] = await this.getParties([id]);
    return party ?? null;
  }
}
