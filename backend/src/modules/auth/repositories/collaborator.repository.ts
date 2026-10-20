export const COLLABORATOR_REPOSITORY = Symbol('COLLABORATOR_REPOSITORY');

export type CollaboratorPersonType = 'PF' | 'PJ';

/** Campos editáveis do colaborador (dados de RH). */
export interface CollaboratorData {
  personType: CollaboratorPersonType;
  name: string;
  document: string | null;
  legalName: string | null;
  rg: string | null;
  birthDate: Date | null;
  phone: string | null;
  email: string | null;
  address: Record<string, unknown> | null;
  positionId: string | null;
  admissionDate: Date | null;
  dismissalDate: Date | null;
  grossSalary: number | null;
  totalCost: number | null;
  hourlyRate: number | null;
  benefits: unknown;
  bankData: unknown;
  pixKeys: unknown;
  cvUrl: string | null;
  notes: string | null;
}

export interface CollaboratorRecord extends CollaboratorData {
  id: string;
  positionName: string | null;
  userId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollaboratorFilter {
  active?: boolean;
  search?: string;
  positionId?: string;
}

export interface PositionRecord {
  id: string;
  name: string;
  active: boolean;
}

/** Colaboradores e funções (schema "auth"). */
export interface CollaboratorRepository {
  list(filter: CollaboratorFilter): Promise<CollaboratorRecord[]>;
  findById(id: string): Promise<CollaboratorRecord | null>;
  documentInUse(document: string, exceptId?: string): Promise<boolean>;
  create(data: CollaboratorData, actorId: string): Promise<CollaboratorRecord>;
  update(
    id: string,
    data: Partial<CollaboratorData> & { active?: boolean },
    actorId: string,
  ): Promise<CollaboratorRecord>;

  listPositions(): Promise<PositionRecord[]>;
  findPosition(id: string): Promise<PositionRecord | null>;
  positionNameInUse(name: string, exceptId?: string): Promise<boolean>;
  createPosition(name: string): Promise<PositionRecord>;
  updatePosition(id: string, changes: { name?: string; active?: boolean }): Promise<PositionRecord>;
}
