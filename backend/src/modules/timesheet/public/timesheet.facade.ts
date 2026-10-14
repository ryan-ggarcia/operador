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

/** Interface pública do módulo timesheet. */
export interface TimesheetFacade {
  /** Minutos apontados (concluídos) por documento. */
  getMinutesBySource(docType: TimesheetDocType, ids: string[]): Promise<Record<string, number>>;
  /** Cronômetros em andamento. */
  getRunningTimers(): Promise<RunningTimer[]>;
}
