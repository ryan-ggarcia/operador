import type { HttpClient } from './http';
import type { JobDetail, Project } from './types';

export interface TemplateTask {
  title: string;
  responsibleId: string | null;
}

export interface TemplateJob {
  id?: string;
  title: string;
  responsibleId: string | null;
  statusId: string | null;
  briefing: string | null;
  tasks: TemplateTask[];
}

export interface Template {
  id: string;
  title: string;
  briefing: string | null;
  active: boolean;
  createdById: string | null;
  jobs: (TemplateJob & { id: string })[];
}

export interface TemplateSummary {
  id: string;
  title: string;
  active: boolean;
  createdById: string | null;
  jobsCount: number;
  tasksCount: number;
  preview: string[];
}

export interface TemplateJobOption extends TemplateJob {
  id: string;
  templateId: string;
  templateTitle: string;
}

export interface TemplateInput {
  title: string;
  briefing: string | null;
  jobs: TemplateJob[];
}

export interface JobFromTemplateInput {
  clientId: string;
  projectId?: string | null;
  title?: string | null;
  responsibleId?: string | null;
  statusId?: string | null;
  deadline?: string | null;
  deadlineHasTime?: boolean;
}

/** Templates de projeto e cópias (duplicar, aplicar template). */
export class TemplatesService {
  constructor(private readonly http: HttpClient) {}

  list(query: { search?: string; includeInactive?: boolean } = {}) {
    return this.http.get<TemplateSummary[]>('/project-templates', { ...query });
  }
  get(id: string) {
    return this.http.get<Template>(`/project-templates/${id}`);
  }
  jobs(search?: string) {
    return this.http.get<TemplateJobOption[]>('/project-templates/jobs', { search });
  }
  create(input: TemplateInput) {
    return this.http.post<Template>('/project-templates', input);
  }
  update(id: string, input: TemplateInput) {
    return this.http.put<Template>(`/project-templates/${id}`, input);
  }
  setActive(id: string, active: boolean) {
    return this.http.put<void>(`/project-templates/${id}/active`, { active });
  }
  remove(id: string) {
    return this.http.delete<void>(`/project-templates/${id}`);
  }
  fromProject(projectId: string, title?: string) {
    return this.http.post<Template>(`/project-templates/from-project/${projectId}`, { title });
  }
  fromJob(jobId: string, title?: string) {
    return this.http.post<Template>(`/project-templates/from-job/${jobId}`, { title });
  }
  createProject(templateId: string, input: { clientId: string; title?: string | null; hidden?: boolean }) {
    return this.http.post<Project>(`/project-templates/${templateId}/projects`, input);
  }
  createJob(templateJobId: string, input: JobFromTemplateInput) {
    return this.http.post<JobDetail>(`/project-templates/jobs/${templateJobId}/jobs`, input);
  }
  duplicateProject(projectId: string, clientId: string) {
    return this.http.post<Project>(`/projects/${projectId}/duplicate`, { clientId });
  }
  applyToProject(projectId: string, templateId: string) {
    return this.http.post<Project>(`/projects/${projectId}/apply-template`, { templateId });
  }
  duplicateJob(jobId: string, destination: { clientId: string; projectId?: string | null }) {
    return this.http.post<JobDetail>(`/jobs/${jobId}/duplicate`, destination);
  }
  applyToJob(jobId: string, templateJobId: string) {
    return this.http.post<JobDetail>(`/jobs/${jobId}/apply-template`, { templateJobId });
  }
}
