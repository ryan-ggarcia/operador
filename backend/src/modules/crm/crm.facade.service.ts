import { Inject, Injectable } from '@nestjs/common';
import type {
  ContactSummary,
  CrmFacade,
  PartyRole,
  PartySummary,
} from './public/crm.facade.js';
import {
  CONTACT_REPOSITORY,
  type ContactRepository,
} from './repositories/contact.repository.js';
import {
  PARTY_REPOSITORY,
  type PartyRecord,
  type PartyRepository,
} from './repositories/party.repository.js';

export function rolesOf(party: Pick<PartyRecord, 'isClient' | 'isSupplier' | 'isProvider' | 'isVehicle'>): PartyRole[] {
  const roles: PartyRole[] = [];
  if (party.isClient) roles.push('client');
  if (party.isSupplier) roles.push('supplier');
  if (party.isProvider) roles.push('provider');
  if (party.isVehicle) roles.push('vehicle');
  return roles;
}

export function toPartySummary(party: PartyRecord): PartySummary {
  return {
    id: party.id,
    name: party.name,
    document: party.document,
    roles: rolesOf(party),
    active: party.active,
  };
}

@Injectable()
export class CrmFacadeService implements CrmFacade {
  constructor(
    @Inject(PARTY_REPOSITORY) private readonly parties: PartyRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
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

  async searchParties(role: PartyRole, term: string, limit = 20): Promise<PartySummary[]> {
    const page = await this.parties.search({
      roles: [role],
      search: term.trim() || undefined,
      active: true,
      limit: Math.min(Math.max(limit, 1), 100),
      offset: 0,
    });
    return page.items.map(toPartySummary);
  }

  async getContacts(ids: string[]): Promise<ContactSummary[]> {
    if (ids.length === 0) return [];
    const contacts = await this.contacts.findByIds([...new Set(ids)]);
    return contacts.map(({ id, partyId, name, email, phone1, active }) => ({
      id,
      partyId,
      name,
      email,
      phone1,
      active,
    }));
  }
}
