import type { HttpClient } from './http';
import type { Page } from './types';

export type TimesheetDocType = 'job' | 'task' | 'project';
export type EntryKind = 'NORMAL' | 'REWORK';

export interface TimeEntry {
  id: string;
  user: { id: string; name: string; color: string | null } | null;
  doc: {
    docType: TimesheetDocType | null;
    id: string;
    jobId: string | null;
    number: string | null;
    title: string | null;
    parentTitle: string | null;
  };
  client: { id: string; name: string } | null;
  projectId: string | null;
  startedAt: string;
  endedAt: string | null;
  minutes: number;
  source: 'TIMER' | 'MANUAL';
  kind: EntryKind;
  description: string | null;
  situation: 'RUNNING' | 'DONE';
  can: { edit: boolean };
}

export interface DocumentSummary {
  estimatedMinutes: number | null;
  realizedMinutes: number;
  balanceMinutes: number | null;
  runningUserIds: string[];
  entries: TimeEntry[];
}

export interface EntryQuery {
  mine?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export class TimesheetService {
  constructor(private readonly http: HttpClient) {}

  current() {
    return this.http.get<TimeEntry | null>('/timesheet/current');
  }
  start(docType: TimesheetDocType, docId: string) {
    return this.http.post<TimeEntry>('/timesheet/start', { docType, docId });
  }
  stop(input: { entryId?: string; description?: string | null; kind?: EntryKind } = {}) {
    return this.http.post<TimeEntry>('/timesheet/stop', input);
  }
  list(query: EntryQuery = {}) {
    return this.http.get<Page<TimeEntry> & { totalMinutes: number }>('/timesheet/entries', { ...query });
  }
  createManual(input: {
    docType: TimesheetDocType;
    docId: string;
    date: string;
    minutes: number;
    kind?: EntryKind;
    description?: string | null;
  }) {
    return this.http.post<TimeEntry>('/timesheet/entries', input);
  }
  update(id: string, input: { description?: string | null; kind?: EntryKind; minutes?: number; date?: string }) {
    return this.http.patch<TimeEntry>(`/timesheet/entries/${id}`, input);
  }
  remove(id: string) {
    return this.http.delete<void>(`/timesheet/entries/${id}`);
  }
  summary(docType: TimesheetDocType, docId: string) {
    return this.http.get<DocumentSummary>(`/timesheet/documents/${docType}/${docId}`);
  }
}
