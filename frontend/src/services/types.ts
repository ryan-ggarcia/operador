/**
 * Formatos da API do operador, como chegam em JSON (datas em texto ISO).
 * O front não importa código do back: estes tipos são a cópia do contrato.
 */

export interface Page<T> {
  items: T[];
  total: number;
}

export type PermissionModule =
  | 'projects'
  | 'jobs'
  | 'medias'
  | 'productions'
  | 'financial'
  | 'clients'
  | 'suppliers'
  | 'providers'
  | 'vehicles'
  | 'employees';

export interface UserPermissions {
  modules: Record<PermissionModule, number>;
  flags: {
    administrator: boolean;
    hiddenProjects: boolean;
    projectBudget: 'none' | 'view' | 'edit';
    financialRevenues: boolean;
    financialExpenses: boolean;
    financialTransfers: boolean;
  };
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  color: string | null;
  avatarFileId: string | null;
  active: boolean;
  mustChangePassword?: boolean;
  isOwner?: boolean;
}

export interface UserRef {
  id: string;
  name: string;
  color: string | null;
  avatarFileId?: string | null;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  color: string | null;
  accessProfileId: string | null;
  accessProfileName: string | null;
  customPermissions: unknown;
  isOwner: boolean;
  mustChangePassword: boolean;
  collaboratorId: string | null;
  active: boolean;
  lastLoginAt: string | null;
  teamIds: string[];
}

export interface AccessProfile {
  id: string;
  name: string;
  permissions: { modules?: Partial<Record<PermissionModule, number>>; flags?: Record<string, unknown> };
  system: boolean;
  userCount: number;
}

export interface Team {
  id: string;
  name: string;
  active: boolean;
  userIds: string[];
}

export type PartyRole = 'client' | 'supplier' | 'provider' | 'vehicle';

export interface PartySummary {
  id: string;
  name: string;
  document: string | null;
  roles: PartyRole[];
  active: boolean;
}

export interface PartyListItem extends PartySummary {
  personType: 'PF' | 'PJ';
  legalName: string | null;
  email: string | null;
  phone1: string | null;
  city: string | null;
  state: string | null;
  clientGroupName: string | null;
}

export interface Party extends PartyListItem {
  stateRegistration: string | null;
  municipalRegistration: string | null;
  phone2: string | null;
  website: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  country: string | null;
  isClient: boolean;
  isSupplier: boolean;
  isProvider: boolean;
  isVehicle: boolean;
  clientGroupId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartyInput {
  personType?: 'PF' | 'PJ';
  name?: string;
  legalName?: string | null;
  document?: string | null;
  email?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  website?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  isClient?: boolean;
  isSupplier?: boolean;
  isProvider?: boolean;
  isVehicle?: boolean;
  clientGroupId?: string | null;
  notes?: string | null;
}

export interface Contact {
  id: string;
  partyId: string;
  name: string;
  email: string | null;
  departmentId: string | null;
  departmentName: string | null;
  phone1: string | null;
  phone2: string | null;
  birthDate: string | null;
  active: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  active: boolean;
}

export type ProjectSituation = 'OPEN' | 'ARCHIVED' | 'CANCELED';
export type JobSituation = 'OPEN' | 'DONE' | 'CANCELED';
export type DocType = 'PROJECT' | 'JOB';

export interface Status {
  id: string;
  docType: DocType;
  name: string;
  color: string;
  order: number;
  active: boolean;
  ignoresDelay: boolean;
  system: boolean;
}

export interface Project {
  id: string;
  number: number;
  title: string;
  client: NamedRef | null;
  description: string | null;
  requester: UserRef | null;
  responsible: UserRef | null;
  members: UserRef[];
  statusId: string | null;
  situation: ProjectSituation;
  hidden: boolean;
  isClientDefault: boolean;
  locked: boolean;
  desiredDeadline: string | null;
  budget: number | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  openJobs?: number;
  totalJobs?: number;
  can: {
    edit: boolean;
    editSpecialFields: boolean;
    changeSituation: boolean;
    unlock: boolean;
    editBudget: boolean;
  };
}

export interface Task {
  id: string;
  jobId: string;
  title: string;
  responsibleId: string | null;
  statusId: string | null;
  order: number;
  startAt: string | null;
  deadline: string | null;
  situation: JobSituation;
  completedAt: string | null;
}

export interface Job {
  id: string;
  number: string;
  title: string;
  project: { id: string; number: number; title: string; situation: ProjectSituation };
  client: NamedRef | null;
  clientContact: NamedRef | null;
  responsible: UserRef | null;
  requester: UserRef | null;
  members: UserRef[];
  statusId: string | null;
  situation: JobSituation;
  startAt: string | null;
  deadline: string | null;
  deadlineHasTime: boolean;
  overdue: boolean;
  estimatedMinutes: number | null;
  briefing?: string | null;
  openTasks: number;
  totalTasks: number;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  can: { edit: boolean; act: boolean };
}

export interface JobDetail extends Job {
  tasks: Task[];
}

export interface Comment {
  id: string;
  authorId: string;
  html: string;
  mentionedUserIds: string[];
  parentId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  userId: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface Agency {
  legalName: string;
  tradeName: string;
  cnpj: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone: string | null;
  address: Record<string, string> | null;
  logoFileId: string | null;
  timezone: string;
  currency: string;
  locale: string;
}
