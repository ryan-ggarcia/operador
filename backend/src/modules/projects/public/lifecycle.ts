/**
 * Ganchos do ciclo de vida dos documentos de projects. Outros módulos (ex.:
 * timesheet) se registram pela fachada para barrar ou reagir ao fechamento
 * de jobs, tarefas e projetos, sem que projects dependa deles.
 */

export interface ClosingDocuments {
  jobIds: string[];
  taskIds: string[];
}

export type ProjectClosing = 'archived' | 'canceled';

export interface DocumentLifecycleListener {
  /**
   * Antes de concluir ou cancelar jobs ou tarefas diretamente. Lança um erro
   * HTTP (ex.: BadRequestException) para impedir.
   */
  beforeClose?(documents: ClosingDocuments): Promise<void>;
  /** Antes de cancelar o projeto (ex.: o financeiro barra se houver faturas). */
  beforeProjectCancel?(projectId: string): Promise<void>;
  /**
   * Depois que o projeto foi arquivado (documentos concluídos) ou cancelado
   * (documentos cancelados). Cada módulo fecha os seus documentos do projeto.
   */
  afterProjectClosed?(projectId: string, actorId: string, outcome: ProjectClosing): Promise<void>;
}
