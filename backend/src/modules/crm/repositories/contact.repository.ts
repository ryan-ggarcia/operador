export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');
export const PARTY_NOTE_REPOSITORY = Symbol('PARTY_NOTE_REPOSITORY');
export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface ContactData {
  name: string;
  email: string | null;
  departmentId: string | null;
  phone1: string | null;
  phone2: string | null;
  birthDate: Date | null;
}

export interface ContactRecord extends ContactData {
  id: string;
  partyId: string;
  departmentName: string | null;
  active: boolean;
}

/** Contatos de clientes, fornecedores e veículos. */
export interface ContactRepository {
  listByParty(partyId: string, includeInactive: boolean): Promise<ContactRecord[]>;
  findByIds(ids: string[]): Promise<ContactRecord[]>;
  create(partyId: string, data: ContactData): Promise<ContactRecord>;
  update(id: string, data: Partial<ContactData> & { active?: boolean }): Promise<ContactRecord>;
}

export interface PartyNoteRecord {
  id: string;
  partyId: string;
  authorId: string;
  html: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Aba Anotações da ficha. */
export interface PartyNoteRepository {
  list(partyId: string): Promise<PartyNoteRecord[]>;
  findById(id: string): Promise<PartyNoteRecord | null>;
  create(partyId: string, authorId: string, html: string): Promise<PartyNoteRecord>;
  update(id: string, html: string): Promise<PartyNoteRecord>;
}

export type CatalogKind = 'clientGroup' | 'department';

export interface CatalogItem {
  id: string;
  name: string;
  active: boolean;
}

/** Cadastros de apoio: grupos de clientes e departamentos. */
export interface CatalogRepository {
  list(kind: CatalogKind): Promise<CatalogItem[]>;
  exists(kind: CatalogKind, id: string): Promise<boolean>;
  nameInUse(kind: CatalogKind, name: string, exceptId?: string): Promise<boolean>;
  create(kind: CatalogKind, name: string): Promise<CatalogItem>;
  update(kind: CatalogKind, id: string, changes: { name?: string; active?: boolean }): Promise<CatalogItem>;
}
