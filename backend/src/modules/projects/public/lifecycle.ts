/**
 * Ganchos do ciclo de vida dos documentos de projects. Outros módulos (ex.:
 * timesheet) se registram pela fachada para barrar ou reagir ao fechamento
 * de jobs, tarefas e projetos, sem que projects dependa deles.
 */

export interface ClosingDocuments {
  jobIds: string[];
  taskIds: string[];
}

export interface DocumentLifecycleListener {
  /**
   * Antes de concluir ou cancelar jobs ou tarefas diretamente. Lança um erro
   * HTTP (ex.: BadRequestException) para impedir.
   */
  beforeClose?(documents: ClosingDocuments): Promise<void>;
  /** Depois que o projeto foi arquivado ou cancelado (com todos os documentos). */
  afterProjectClosed?(projectId: string, actorId: string): Promise<void>;
}
