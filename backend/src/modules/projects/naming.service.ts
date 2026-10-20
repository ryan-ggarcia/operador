import { Inject, Injectable } from '@nestjs/common';
import { AUTH_FACADE, type AuthFacade } from '../auth/public/index.js';
import { CRM_FACADE, type CrmFacade } from '../crm/public/index.js';

export interface NamedRef {
  id: string;
  name: string;
}

export interface UserRef extends NamedRef {
  color: string | null;
  avatarFileId: string | null;
}

export interface ResolvedNames {
  client(id: string | null): NamedRef | null;
  contact(id: string | null): NamedRef | null;
  user(id: string | null): UserRef | null;
  users(ids: string[]): UserRef[];
}

/**
 * Busca em lote os nomes de clientes, contatos e usuários pelas fachadas de
 * crm e auth, em vez de copiar nomes para as tabelas do módulo.
 */
@Injectable()
export class NamingService {
  constructor(
    @Inject(CRM_FACADE) private readonly crm: CrmFacade,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
  ) {}

  async resolve(ids: {
    clientIds?: (string | null)[];
    contactIds?: (string | null)[];
    userIds?: (string | null)[];
  }): Promise<ResolvedNames> {
    const compact = (list: (string | null)[] = []) =>
      [...new Set(list.filter((id): id is string => Boolean(id)))];
    const [clients, contacts, users] = await Promise.all([
      this.crm.getParties(compact(ids.clientIds)),
      this.crm.getContacts(compact(ids.contactIds)),
      this.auth.getUsers(compact(ids.userIds)),
    ]);
    const clientMap = new Map(clients.map((item) => [item.id, { id: item.id, name: item.name }]));
    const contactMap = new Map(contacts.map((item) => [item.id, { id: item.id, name: item.name }]));
    const userMap = new Map(
      users.map((item) => [
        item.id,
        { id: item.id, name: item.name, color: item.color, avatarFileId: item.avatarFileId },
      ]),
    );
    return {
      client: (id) => (id ? (clientMap.get(id) ?? null) : null),
      contact: (id) => (id ? (contactMap.get(id) ?? null) : null),
      user: (id) => (id ? (userMap.get(id) ?? null) : null),
      users: (list) => list.map((id) => userMap.get(id)).filter((u): u is UserRef => Boolean(u)),
    };
  }

  /** Cliente ativo (job e projeto novos não aceitam cliente inativo). */
  async isActiveClient(clientId: string): Promise<boolean> {
    const party = await this.crm.getParty(clientId);
    return Boolean(party && party.active && party.roles.includes('client'));
  }

  /** Todos os ids são de usuários ativos. */
  /** Quais destes usuários existem e estão ativos. */
  async activeUserIds(userIds: string[]): Promise<Set<string>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Set();
    const users = await this.auth.getUsers(unique);
    return new Set(users.filter((user) => user.active).map((user) => user.id));
  }

  async areActiveUsers(userIds: string[]): Promise<boolean> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return true;
    const users = await this.auth.getUsers(unique);
    return users.length === unique.length && users.every((user) => user.active);
  }

  /** O contato pertence ao cliente. */
  async isContactOf(contactId: string, clientId: string): Promise<boolean> {
    const [contact] = await this.crm.getContacts([contactId]);
    return Boolean(contact && contact.partyId === clientId);
  }
}
