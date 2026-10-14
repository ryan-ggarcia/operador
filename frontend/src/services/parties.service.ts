import type { HttpClient } from './http';
import type {
  Agency,
  CatalogItem,
  Contact,
  Page,
  Party,
  PartyInput,
  PartyListItem,
  PartyRole,
  PartySummary,
} from './types';

export interface PartyQuery {
  role?: PartyRole;
  search?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface ContactInput {
  name?: string;
  email?: string | null;
  phone1?: string | null;
  departmentId?: string | null;
  active?: boolean;
}

export class PartiesService {
  constructor(private readonly http: HttpClient) {}

  list(query: PartyQuery = {}) {
    return this.http.get<Page<PartyListItem>>('/parties', { ...query });
  }
  options(role: PartyRole, search?: string) {
    return this.http.get<PartySummary[]>('/parties/options', { role, search });
  }
  get(id: string) {
    return this.http.get<Party>(`/parties/${id}`);
  }
  create(input: PartyInput & { name: string }) {
    return this.http.post<Party>('/parties', input);
  }
  update(id: string, input: PartyInput) {
    return this.http.patch<Party>(`/parties/${id}`, input);
  }
  setActive(id: string, active: boolean) {
    return this.http.post<Party>(`/parties/${id}/${active ? 'activate' : 'deactivate'}`);
  }
  contacts(partyId: string, includeInactive = false) {
    return this.http.get<Contact[]>(`/parties/${partyId}/contacts`, { includeInactive });
  }
  createContact(partyId: string, input: ContactInput & { name: string }) {
    return this.http.post<Contact>(`/parties/${partyId}/contacts`, input);
  }
  updateContact(id: string, input: ContactInput) {
    return this.http.patch<Contact>(`/contacts/${id}`, input);
  }
  clientGroups() {
    return this.http.get<CatalogItem[]>('/client-groups');
  }
}

export class SettingsService {
  constructor(private readonly http: HttpClient) {}

  agency() {
    return this.http.get<Agency>('/settings/agency');
  }
  updateAgency(input: Partial<Agency>) {
    return this.http.put<Agency>('/settings/agency', input);
  }
}
