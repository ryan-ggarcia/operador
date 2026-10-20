import type { UserPermissions } from '../../auth/public/index.js';

/** Token de injeção da fachada do módulo timesheet. */
export const TIMESHEET_FACADE = Symbol('TIMESHEET_FACADE');

/** Documento que recebe apontamento (minúsculo, como em projects). */
export type TimesheetDocType = 'job' | 'task' | 'project';

export interface RunningTimer {
  userId: string;
  docType: TimesheetDocType;
  docId: string;
  startedAt: Date;
}

/** Estimado × realizado e apontamentos de um job (aba Timesheet). */
export interface JobHours {
  estimatedMinutes: number | null;
  /** Job + tarefas, de todos os apontamentos concluídos. */
  realizedMinutes: number;
  balanceMinutes: number | null;
  runningCount: number;
  /** Sem leitura total em jobs, a lista traz só os próprios apontamentos. */
  onlyOwnEntries: boolean;
  /** Até 200 apontamentos. */
  entries: {
    user: string | null;
    /** Título da tarefa, ou do job quando apontado no job. */
    doc: string | null;
    startedAt: Date;
    minutes: number;
    kind: 'NORMAL' | 'REWORK';
    description: string | null;
    running: boolean;
  }[];
}

/** Interface pública do módulo timesheet. */
export interface TimesheetFacade {
  /** Horas do job com as regras da aba Timesheet (sem acesso: 403; job que não vê: 404). */
  getJobHoursForUser(userId: string, access: UserPermissions, jobId: string): Promise<JobHours>;
  /** Minutos apontados (concluídos) por documento. */
  getMinutesBySource(docType: TimesheetDocType, ids: string[]): Promise<Record<string, number>>;
  /** Cronômetros em andamento. */
  getRunningTimers(): Promise<RunningTimer[]>;
}
