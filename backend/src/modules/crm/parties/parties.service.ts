import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diffFields } from '../../../shared/history/diff.js';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import type { Page } from '../../../shared/validation/pagination.js';
import { isValidDocument, onlyDigits } from '../../../shared/validation/br-document.js';
import type { UserPermissions } from '../../auth/public/index.js';
import { rolesOf, toPartySummary } from '../crm.facade.service.js';
import {
  canReadParty,
  canWriteParty,
  readableRoles,
} from '../domain/party-access.js';
import type { PartyRole, PartySummary } from '../public/crm.facade.js';
import {
  CONTACT_REPOSITORY,
  PARTY_NOTE_REPOSITORY,
  type ContactData,
  type ContactRecord,
  type ContactRepository,
  type PartyNoteRecord,
  type PartyNoteRepository,
} from '../repositories/contact.repository.js';
import {
  PARTY_REPOSITORY,
  type PartyData,
  type PartyDetail,
  type PartyListItem,
  type PartyRepository,
} from '../repositories/party.repository.js';

export interface PartyListQuery {
  role?: PartyRole;
  search?: string;
  active?: boolean;
  clientGroupId?: string;
  limit: number;
  offset: number;
}

export type PartyView = PartyDetail & { roles: PartyRole[] };
export type PartyListView = PartyListItem & { roles: PartyRole[] };

const HISTORY_FIELDS = [
  'personType', 'name', 'legalName', 'document', 'stateRegistration',
  'municipalRegistration', 'email', 'phone1', 'phone2', 'website', 'zipCode',
  'street', 'number', 'complement', 'district', 'city', 'state', 'country',
  'isClient', 'isSupplier', 'isProvider', 'isVehicle', 'clientGroupId', 'notes',
  'active',
] as const;

function nextRoles(current: PartyData, changes: Partial<PartyData>): PartyRole[] {
  return rolesOf({ ...current, ...stripUndefined(changes) });
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

/**
 * Cadastro único de pessoas com papéis (cliente, fornecedor, prestador,
 * veículo). O mesmo CPF/CNPJ não vira dois cadastros: a pessoa acumula papéis.
 */
@Injectable()
export class PartiesService {
  constructor(
    @Inject(PARTY_REPOSITORY) private readonly parties: PartyRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(PARTY_NOTE_REPOSITORY) private readonly notes: PartyNoteRepository,
  ) {}

  async list(access: UserPermissions, query: PartyListQuery): Promise<Page<PartyListView>> {
    const readable = readableRoles(access);
    const roles = query.role ? readable.filter((role) => role === query.role) : readable;
    if (roles.length === 0) throw new ForbiddenException('Sem acesso a estes cadastros.');
    const page = await this.parties.search({ ...query, roles });
    return {
      total: page.total,
      items: page.items.map((item) => ({ ...item, roles: rolesOf(item) })),
    };
  }

  /** Nomes para seletores (ex.: cliente do job): qualquer usuário logado. */
  async options(role: PartyRole, search?: string): Promise<PartySummary[]> {
    const page = await this.parties.search({
      roles: [role],
      search,
      active: true,
      limit: 30,
      offset: 0,
    });
    return page.items.map(toPartySummary);
  }

  async get(access: UserPermissions, id: string): Promise<PartyView> {
    const party = await this.requireParty(id);
    if (!canReadParty(access, rolesOf(party))) {
      throw new ForbiddenException('Sem acesso a este cadastro.');
    }
    return { ...party, roles: rolesOf(party) };
  }

  async create(access: UserPermissions, data: PartyData, actorId: string): Promise<PartyView> {
    const roles = rolesOf(data);
    if (roles.length === 0) throw new BadRequestException('Marque pelo menos um papel.');
    if (!canWriteParty(access, roles)) {
      throw new ForbiddenException('Sem permissão para cadastrar com estes papéis.');
    }
    const clean = await this.validate(data);
    const party = await this.parties.create(clean, actorId);
    return { ...party, roles: rolesOf(party) };
  }

  async update(
    access: UserPermissions,
    id: string,
    changes: Partial<PartyData>,
    actorId: string,
  ): Promise<PartyView> {
    const current = await this.requireParty(id);
    const roles = nextRoles(current, changes);
    if (roles.length === 0) throw new BadRequestException('Marque pelo menos um papel.');
    if (!canWriteParty(access, rolesOf(current), roles)) {
      throw new ForbiddenException('Sem permissão para alterar este cadastro.');
    }
    const clean = await this.validate({ ...current, ...stripUndefined(changes) }, id);
    const data = Object.fromEntries(
      Object.keys(stripUndefined(changes)).map((key) => [key, clean[key as keyof PartyData]]),
    ) as Partial<PartyData>;
    const party = await this.parties.update(
      id,
      data,
      actorId,
      diffFields<PartyDetail>(current, data, HISTORY_FIELDS),
    );
    return { ...party, roles: rolesOf(party) };
  }

  /** Cadastros não são excluídos: são desativados e reativados. */
  async setActive(
    access: UserPermissions,
    id: string,
    active: boolean,
    actorId: string,
  ): Promise<PartyView> {
    const current = await this.requireParty(id);
    if (!canWriteParty(access, rolesOf(current))) {
      throw new ForbiddenException('Sem permissão para alterar este cadastro.');
    }
    const changes = diffFields(current, { active }, ['active']);
    const party = await this.parties.update(id, { active }, actorId, changes);
    return { ...party, roles: rolesOf(party) };
  }

  async listContacts(
    access: UserPermissions,
    partyId: string,
    includeInactive: boolean,
  ): Promise<ContactRecord[]> {
    await this.get(access, partyId);
    return this.contacts.listByParty(partyId, includeInactive);
  }

  async createContact(
    access: UserPermissions,
    partyId: string,
    data: ContactData,
  ): Promise<ContactRecord> {
    await this.requireWritable(access, partyId);
    return this.contacts.create(partyId, { ...data, name: data.name.trim() });
  }

  async updateContact(
    access: UserPermissions,
    contactId: string,
    data: Partial<ContactData> & { active?: boolean },
  ): Promise<ContactRecord> {
    const [contact] = await this.contacts.findByIds([contactId]);
    if (!contact) throw new NotFoundException('Contato não encontrado.');
    await this.requireWritable(access, contact.partyId);
    return this.contacts.update(contactId, data);
  }

  async listNotes(access: UserPermissions, partyId: string): Promise<PartyNoteRecord[]> {
    await this.get(access, partyId);
    return this.notes.list(partyId);
  }

  async addNote(
    access: UserPermissions,
    partyId: string,
    html: string,
    authorId: string,
  ): Promise<PartyNoteRecord> {
    await this.get(access, partyId);
    const clean = sanitizeRichText(html);
    if (!clean) throw new BadRequestException('A anotação está vazia.');
    return this.notes.create(partyId, authorId, clean);
  }

  /** Só o autor edita a própria anotação. */
  async updateNote(noteId: string, html: string, authorId: string): Promise<PartyNoteRecord> {
    const note = await this.notes.findById(noteId);
    if (!note) throw new NotFoundException('Anotação não encontrada.');
    if (note.authorId !== authorId) {
      throw new ForbiddenException('Só o autor pode editar a anotação.');
    }
    const clean = sanitizeRichText(html);
    if (!clean) throw new BadRequestException('A anotação está vazia.');
    return this.notes.update(noteId, clean);
  }

  private async requireParty(id: string): Promise<PartyDetail> {
    const party = await this.parties.findDetail(id);
    if (!party) throw new NotFoundException('Cadastro não encontrado.');
    return party;
  }

  private async requireWritable(access: UserPermissions, partyId: string): Promise<void> {
    const party = await this.requireParty(partyId);
    if (!canWriteParty(access, rolesOf(party))) {
      throw new ForbiddenException('Sem permissão para alterar este cadastro.');
    }
  }

  private async validate(data: PartyData, exceptId?: string): Promise<PartyData> {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Informe o nome.');
    const document = data.document ? onlyDigits(data.document) : null;
    if (document) {
      if (!isValidDocument(document, data.personType)) {
        throw new BadRequestException(data.personType === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.');
      }
      const existing = await this.parties.findByDocument(document);
      if (existing && existing.id !== exceptId) {
        // A tela oferece acumular o papel no cadastro que já existe.
        throw new ConflictException({
          message: 'Já existe um cadastro com este documento.',
          partyId: existing.id,
          partyName: existing.name,
        });
      }
    }
    if (data.clientGroupId && !(await this.parties.clientGroupExists(data.clientGroupId))) {
      throw new BadRequestException('Grupo de clientes não encontrado.');
    }
    return {
      ...data,
      name,
      document,
      notes: sanitizeRichText(data.notes),
      state: data.state ? data.state.toUpperCase() : data.state,
      zipCode: data.zipCode ? onlyDigits(data.zipCode) : data.zipCode,
    };
  }
}
