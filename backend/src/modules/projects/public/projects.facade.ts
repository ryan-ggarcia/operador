import type { JobSituation } from '../domain/job-rules.js';
import type { ProjectSituation } from '../domain/project-rules.js';

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

export type ProjectDocumentType = 'project' | 'job';

/** Referência a um documento do módulo (para timesheet, arquivos, IA). */
export interface DocumentRef {
  docType: ProjectDocumentType;
  id: string;
  projectId: string;
  clientId: string;
  number: string;
  title: string;
  situation: ProjectSituation | JobSituation;
  /** Envolvidos (responsável, solicitante e membros). */
  involvedUserIds: string[];
}

export interface ReservedSequence {
  projectNumber: number;
  sequence: number;
  /** Número exibido do novo documento. */
  number: string;
}

/** Interface pública do módulo projects. */
export interface ProjectsFacade {
  getProject(id: string): Promise<ProjectSummary | null>;
  getProjects(ids: string[]): Promise<ProjectSummary[]>;
  getJobs(ids: string[]): Promise<JobSummary[]>;
  getDocumentRef(docType: ProjectDocumentType, id: string): Promise<DocumentRef | null>;
  countByClient(clientId: string): Promise<{ projects: number; openJobs: number }>;
  /** Projeto "Geral" do cliente, criado na primeira vez. */
  ensureClientDefaultProject(clientId: string): Promise<ProjectSummary>;
  /**
   * Próximo número de documento do projeto (jobs, mídias e produções
   * dividem a sequência). O projeto precisa estar aberto.
   */
  reserveDocumentSequence(projectId: string): Promise<ReservedSequence>;
}
