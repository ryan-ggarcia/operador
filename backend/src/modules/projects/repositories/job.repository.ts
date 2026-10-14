import type { FieldChange } from '../../../shared/history/diff.js';
import type { Page } from '../../../shared/validation/pagination.js';
import type { JobSituation } from '../domain/job-rules.js';
import type { ProjectSituation } from '../domain/project-rules.js';

export const JOB_REPOSITORY = Symbol('JOB_REPOSITORY');

export interface JobRecord {
  id: string;
  projectId: string;
  projectNumber: number;
  projectTitle: string;
  projectHidden: boolean;
  projectSituation: ProjectSituation;
  /** Responsável, solicitante e membros do projeto. */
  projectInvolvedIds: string[];
  sequence: number;
  title: string;
  clientId: string;
  clientContactId: string | null;
  responsibleId: string | null;
  requesterId: string | null;
  statusId: string | null;
  statusIgnoresDelay: boolean;
  situation: JobSituation;
  startAt: Date | null;
  deadline: Date | null;
  deadlineHasTime: boolean;
  estimatedMinutes: number | null;
  briefing: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  memberIds: string[];
  openTasks: number;
  totalTasks: number;
}

/** Mesma ideia de ProjectVisibility, para jobs. */
export interface JobVisibility {
  userId: string;
  readAll: boolean;
  allHidden: boolean;
}

export interface JobFilter {
  visibility: JobVisibility;
  search?: string;
  situations?: JobSituation[];
  clientId?: string;
  projectId?: string;
  responsibleIds?: string[];
  statusIds?: string[];
  withoutStatus?: boolean;
  /** "Minha pauta": jobs em que o usuário está envolvido. */
  involvedUserId?: string;
  deadlineFrom?: Date;
  deadlineTo?: Date;
  /** Só os atrasados (aberto, prazo vencido, status que conta atraso). */
  overdueAt?: Date;
  orderBy: 'deadline' | 'createdAt' | 'number';
  limit: number;
  offset: number;
}

export interface NewJob {
  projectId: string;
  title: string;
  clientId: string;
  clientContactId: string | null;
  responsibleId: string | null;
  requesterId: string;
  statusId: string | null;
  startAt: Date | null;
  deadline: Date | null;
  deadlineHasTime: boolean;
  estimatedMinutes: number | null;
  briefing: string | null;
  memberIds: string[];
}

export interface JobChanges {
  title?: string;
  clientContactId?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  startAt?: Date | null;
  deadline?: Date | null;
  deadlineHasTime?: boolean;
  estimatedMinutes?: number | null;
  briefing?: string | null;
}

export interface TaskRecord {
  id: string;
  jobId: string;
  title: string;
  responsibleId: string | null;
  statusId: string | null;
  order: number;
  startAt: Date | null;
  deadline: Date | null;
  situation: JobSituation;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskData {
  title: string;
  responsibleId: string | null;
  statusId: string | null;
  startAt: Date | null;
  deadline: Date | null;
}

/** Jobs e tarefas (schema "projects"). */
export interface JobRepository {
  list(filter: JobFilter): Promise<Page<JobRecord>>;
  findById(id: string): Promise<JobRecord | null>;
  findByIds(ids: string[]): Promise<JobRecord[]>;
  /** Reserva o número no projeto e cria o job, na mesma transação. */
  create(data: NewJob, actorId: string): Promise<JobRecord>;
  /**
   * Grava a alteração e o histórico. Briefing alterado gera uma versão;
   * novo responsável vira membro.
   */
  update(id: string, changes: JobChanges, actorId: string, history: FieldChange[]): Promise<JobRecord>;
  addMembers(id: string, userIds: string[]): Promise<void>;
  removeMember(id: string, userId: string): Promise<void>;
  changeSituation(id: string, situation: JobSituation, actorId: string): Promise<JobRecord>;
  /** Move o job para outro projeto do mesmo cliente, com número novo. */
  move(id: string, projectId: string, actorId: string): Promise<JobRecord>;
  countOpenByClient(clientId: string): Promise<number>;

  listTasks(jobId: string): Promise<TaskRecord[]>;
  findTask(id: string): Promise<TaskRecord | null>;
  createTask(jobId: string, data: TaskData, actorId: string): Promise<TaskRecord>;
  updateTask(id: string, data: Partial<TaskData> & { order?: number }, actorId: string): Promise<TaskRecord>;
  changeTaskSituation(id: string, situation: JobSituation, actorId: string): Promise<TaskRecord>;
}
