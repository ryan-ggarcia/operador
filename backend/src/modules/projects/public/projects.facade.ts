import type { UserPermissions } from '../../auth/public/index.js';
import type { JobSituation } from '../domain/job-rules.js';
import type { ProjectSituation } from '../domain/project-rules.js';
import type { DocumentLifecycleListener } from './lifecycle.js';

export type { JobSituation } from '../domain/job-rules.js';
export type { ProjectSituation } from '../domain/project-rules.js';

/** Token de injeção da fachada do módulo projects. */
export const PROJECTS_FACADE = Symbol('PROJECTS_FACADE');

export interface ProjectSummary {
  id: string;
  number: number;
  title: string;
  clientId: string;
  situation: ProjectSituation;
  hidden: boolean;
  isClientDefault: boolean;
  responsibleId: string | null;
}

export interface JobSummary {
  id: string;
  projectId: string;
  /** Número exibido: <projeto>.<sequência>. */
  number: string;
  title: string;
  clientId: string;
  situation: JobSituation;
  responsibleId: string | null;
  statusId: string | null;
  deadline: Date | null;
  estimatedMinutes: number | null;
}

export type ProjectDocumentType = 'project' | 'job' | 'task';

/** Referência a um documento do módulo (para timesheet, arquivos, IA). */
export interface DocumentRef {
  docType: ProjectDocumentType;
  id: string;
  projectId: string;
  /** Job da tarefa (ou o próprio job); nulo para projeto. */
  jobId: string | null;
  clientId: string;
  /** Número exibido (a tarefa usa o número do job). */
  number: string;
  title: string;
  /** Título do job, quando o documento é uma tarefa. */
  parentTitle: string | null;
  situation: ProjectSituation | JobSituation;
  /** Aceita trabalho: o documento e os de cima (job, projeto) estão abertos. */
  open: boolean;
  /** Envolvidos (responsável, solicitante e membros). */
  involvedUserIds: string[];
}

export interface ReservedSequence {
  projectNumber: number;
  sequence: number;
  /** Número exibido do novo documento. */
  number: string;
}

/** Busca de jobs com as regras da pauta (assistente de IA). */
export interface JobSearchQuery {
  /** Título ou número ("123.4"). */
  search?: string;
  clientId?: string;
  /** Parte do nome do status. */
  statusName?: string;
  situations?: JobSituation[];
  overdue?: boolean;
  /** Só os jobs em que o usuário está envolvido. */
  mine?: boolean;
  limit: number;
}

/** Job resumido, só com nomes (sem ids de pessoas). */
export interface JobBrief {
  id: string;
  number: string;
  title: string;
  client: string | null;
  project: { id: string; number: number; title: string };
  responsible: string | null;
  status: string | null;
  situation: JobSituation;
  startAt: Date | null;
  deadline: Date | null;
  overdue: boolean;
  estimatedMinutes: number | null;
  openTasks: number;
  totalTasks: number;
}

export interface JobDetail extends JobBrief {
  requester: string | null;
  members: string[];
  /** Briefing em texto puro (cortado em 4.000 caracteres). */
  briefing: string | null;
  tasks: {
    id: string;
    title: string;
    situation: JobSituation;
    status: string | null;
    responsible: string | null;
    startAt: Date | null;
    deadline: Date | null;
    /** Depende de tarefa ainda aberta (workflow). */
    blocked: boolean;
  }[];
}

/** Interface pública do módulo projects. */
export interface ProjectsFacade {
  /** Jobs que o usuário vê na pauta (sem acesso a jobs: erro 403). */
  searchJobsForUser(
    userId: string,
    access: UserPermissions,
    query: JobSearchQuery,
  ): Promise<{ total: number; items: JobBrief[] }>;
  /** Job com tarefas e briefing, se o usuário o vê (senão, 404). */
  getJobDetailForUser(userId: string, access: UserPermissions, jobId: string): Promise<JobDetail>;
  getProject(id: string): Promise<ProjectSummary | null>;
  getProjects(ids: string[]): Promise<ProjectSummary[]>;
  getJobs(ids: string[]): Promise<JobSummary[]>;
  getDocumentRef(docType: ProjectDocumentType, id: string): Promise<DocumentRef | null>;
  /** Como getDocumentRef, mas nulo se o usuário não pode ver o documento. */
  getDocumentForUser(
    docType: ProjectDocumentType,
    id: string,
    userId: string,
    access: UserPermissions,
  ): Promise<DocumentRef | null>;
  /**
   * Ids dos projetos ocultos em que o usuário não é envolvido (responsável,
   * solicitante ou membro), entre os informados ou entre todos.
   */
  getHiddenProjectIdsNotInvolving(userId: string, projectIds?: string[]): Promise<string[]>;
  /** Ids das tarefas de cada job. */
  getTaskIds(jobIds: string[]): Promise<Record<string, string[]>>;
  /** Ganchos de outros módulos no fechamento de documentos. */
  registerLifecycleListener(listener: DocumentLifecycleListener): void;
  countByClient(clientId: string): Promise<{ projects: number; openJobs: number }>;
  /** Projeto "Geral" do cliente, criado na primeira vez. */
  ensureClientDefaultProject(clientId: string): Promise<ProjectSummary>;
  /**
   * Próximo número de documento do projeto (jobs, mídias e produções
   * dividem a sequência). O projeto precisa estar aberto.
   */
  reserveDocumentSequence(projectId: string): Promise<ReservedSequence>;
}
