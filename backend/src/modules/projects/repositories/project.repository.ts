import type { FieldChange } from '../../../shared/history/diff.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { ProjectSituation } from '../domain/project-rules.js';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectRecord {
  id: string;
  number: number;
  title: string;
  clientId: string;
  description: string | null;
  requesterId: string | null;
  responsibleId: string | null;
  statusId: string | null;
  situation: ProjectSituation;
  hidden: boolean;
  isClientDefault: boolean;
  desiredDeadline: Date | null;
  budget: number;
  lastDocumentSequence: number;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberIds: string[];
}

export interface ProjectListItem extends ProjectRecord {
  favorite: boolean;
  openJobs: number;
  totalJobs: number;
}

/**
 * Quem o usuário pode ver na lista: com leitura total, todos os visíveis e
 * os ocultos em que está envolvido (todos os ocultos, se administrador do
 * módulo); sem leitura total, só os projetos em que está envolvido.
 */
export interface ProjectVisibility {
  userId: string;
  readAll: boolean;
  allHidden: boolean;
}

export interface ProjectFilter {
  visibility: ProjectVisibility;
  search?: string;
  situations?: ProjectSituation[];
  clientId?: string;
  statusIds?: string[];
  /** Inclui "sem status". */
  withoutStatus?: boolean;
  responsibleId?: string;
  favoritesOnly?: boolean;
  limit: number;
  offset: number;
}

export interface NewProject {
  title: string;
  clientId: string;
  description: string | null;
  hidden: boolean;
  requesterId: string;
  responsibleId: string;
}

export interface ProjectChanges {
  title?: string;
  description?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  hidden?: boolean;
  desiredDeadline?: Date | null;
  budget?: number;
}

export interface HistoryEntry {
  id: string;
  userId: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

/** O que acontece com os jobs quando a situação do projeto muda. */
export type JobCascade = 'complete' | 'cancel' | 'reopen' | 'none';

/** Projetos (schema "projects"). */
export interface ProjectRepository {
  list(filter: ProjectFilter): Promise<Page<ProjectListItem>>;
  findById(id: string): Promise<ProjectRecord | null>;
  findByIds(ids: string[]): Promise<ProjectRecord[]>;
  isFavorite(id: string, userId: string): Promise<boolean>;
  create(data: NewProject, actorId: string): Promise<ProjectRecord>;
  /**
   * Projeto "Geral" do cliente: devolve o existente ou cria (sem
   * responsável). Seguro contra criação simultânea.
   */
  ensureClientDefault(clientId: string): Promise<ProjectRecord>;
  /** Grava a alteração e o histórico; novos responsáveis viram membros. */
  update(
    id: string,
    changes: ProjectChanges,
    actorId: string,
    history: FieldChange[],
  ): Promise<ProjectRecord>;
  addMembers(id: string, userIds: string[]): Promise<void>;
  removeMember(id: string, userId: string): Promise<void>;
  setFavorite(id: string, userId: string, favorite: boolean): Promise<void>;
  /** Muda a situação do projeto e, na mesma transação, a dos jobs e tarefas. */
  changeSituation(
    id: string,
    situation: ProjectSituation,
    cascade: JobCascade,
    actorId: string,
  ): Promise<ProjectRecord>;
  /** Incrementa a sequência de documentos do projeto numa só instrução. */
  reserveDocumentSequence(id: string): Promise<{ number: number; sequence: number }>;
  countByClient(clientId: string): Promise<number>;
  /** Histórico de alterações de um projeto ou job, do mais novo ao mais antigo. */
  listHistory(entityType: 'project' | 'job', entityId: string): Promise<HistoryEntry[]>;
}
