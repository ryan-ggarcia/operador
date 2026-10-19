import type { HttpClient } from './http';
import type {
  Comment,
  DocType,
  HistoryEntry,
  Job,
  JobDetail,
  JobSituation,
  Page,
  Project,
  ProjectSituation,
  Status,
  Task,
} from './types';

export interface ProjectQuery {
  search?: string;
  situations?: ProjectSituation[];
  clientId?: string;
  favoritesOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProjectInput {
  title?: string;
  clientId?: string;
  description?: string | null;
  hidden?: boolean;
  responsibleId?: string | null;
  statusId?: string | null;
  budget?: number;
}

export class ProjectsService {
  constructor(private readonly http: HttpClient) {}

  list(query: ProjectQuery = {}) {
    return this.http.get<Page<Project>>('/projects', { ...query });
  }
  get(id: string) {
    return this.http.get<Project>(`/projects/${id}`);
  }
  create(input: ProjectInput & { title: string; clientId: string }) {
    return this.http.post<Project>('/projects', input);
  }
  update(id: string, input: ProjectInput) {
    return this.http.patch<Project>(`/projects/${id}`, input);
  }
  archive(id: string) {
    return this.http.post<Project>(`/projects/${id}/archive`);
  }
  cancel(id: string) {
    return this.http.post<Project>(`/projects/${id}/cancel`);
  }
  reopen(id: string, reopenDocuments: boolean) {
    return this.http.post<Project>(`/projects/${id}/reopen`, { reopenDocuments });
  }
  unlock(id: string) {
    return this.http.post<Project>(`/projects/${id}/unlock`);
  }
  setFavorite(id: string, favorite: boolean) {
    return favorite
      ? this.http.put<void>(`/projects/${id}/favorite`)
      : this.http.delete<void>(`/projects/${id}/favorite`);
  }
  history(id: string) {
    return this.http.get<HistoryEntry[]>(`/projects/${id}/history`);
  }
}

export interface JobQuery {
  search?: string;
  situations?: JobSituation[];
  clientId?: string;
  projectId?: string;
  responsibleIds?: string[];
  statusIds?: string[];
  mine?: boolean;
  overdue?: boolean;
  orderBy?: 'deadline' | 'createdAt' | 'number';
  limit?: number;
  offset?: number;
}

export interface JobInput {
  title?: string;
  clientId?: string;
  projectId?: string | null;
  clientContactId?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  /** "AAAA-MM-DD" ou data e hora ISO. */
  deadline?: string | null;
  deadlineHasTime?: boolean;
  estimatedMinutes?: number | null;
  briefing?: string | null;
}

export type JobAction = 'complete' | 'cancel' | 'reopen';

export class JobsService {
  constructor(private readonly http: HttpClient) {}

  list(query: JobQuery = {}) {
    return this.http.get<Page<Job>>('/jobs', { ...query });
  }
  get(id: string) {
    return this.http.get<JobDetail>(`/jobs/${id}`);
  }
  create(input: JobInput & { title: string; clientId: string }) {
    return this.http.post<Job>('/jobs', input);
  }
  update(id: string, input: JobInput) {
    return this.http.patch<Job>(`/jobs/${id}`, input);
  }
  act(id: string, action: JobAction) {
    return this.http.post<Job>(`/jobs/${id}/${action}`);
  }
  addMembers(id: string, userIds: string[]) {
    return this.http.post<Job>(`/jobs/${id}/members`, { userIds });
  }
  removeMember(id: string, userId: string) {
    return this.http.delete<Job>(`/jobs/${id}/members/${userId}`);
  }
  history(id: string) {
    return this.http.get<HistoryEntry[]>(`/jobs/${id}/history`);
  }
  createTask(jobId: string, title: string, responsibleId?: string | null) {
    return this.http.post<Task>(`/jobs/${jobId}/tasks`, { title, responsibleId });
  }
  actOnTask(taskId: string, action: JobAction) {
    return this.http.post<Task>(`/tasks/${taskId}/${action}`);
  }
  createRecurrence(id: string, rule: RecurrenceRule) {
    return this.http.post<{ total: number; jobIds: string[] }>(`/jobs/${id}/recurrence`, rule);
  }
  postpone(input: PostponeInput) {
    return this.http.post<{ jobs: number; tasks: number; skipped: number }>('/jobs/postpone', input);
  }
  /** Workflow: cada tarefa aberta depende da anterior. */
  setWorkflow(id: string) {
    return this.http.post<JobDetail>(`/jobs/${id}/workflow`);
  }
  clearWorkflow(id: string) {
    return this.http.delete<JobDetail>(`/jobs/${id}/workflow`);
  }
}

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  businessDaysOnly?: boolean;
  weekdays?: number[];
  monthlyMode?: 'SAME_DAY' | 'LAST_DAY';
  count?: number;
  until?: string;
}

export interface PostponeInput {
  jobIds: string[];
  amount: number;
  unit: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
  target: 'JOB' | 'TASKS' | 'BOTH';
  businessDaysOnly?: boolean;
}

export class CommentsService {
  constructor(private readonly http: HttpClient) {}

  list(docType: DocType, docId: string) {
    return this.http.get<Comment[]>(`/${docType === 'JOB' ? 'jobs' : 'projects'}/${docId}/comments`);
  }
  create(docType: DocType, docId: string, html: string, mentionedUserIds: string[] = []) {
    return this.http.post<Comment>(`/${docType === 'JOB' ? 'jobs' : 'projects'}/${docId}/comments`, {
      html,
      mentionedUserIds,
    });
  }
  remove(id: string) {
    return this.http.delete<void>(`/comments/${id}`);
  }
}

export class StatusesService {
  constructor(private readonly http: HttpClient) {}

  list(docType: DocType, includeInactive = false) {
    return this.http.get<Status[]>('/project-statuses', { docType, includeInactive });
  }
}
