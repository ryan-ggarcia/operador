import type { TemplateData, TemplateJobData } from '../domain/template-rules.js';

export const TEMPLATE_REPOSITORY = Symbol('TEMPLATE_REPOSITORY');

export interface TemplateJobRecord extends TemplateJobData {
  id: string;
  order: number;
}

export interface TemplateRecord extends Omit<TemplateData, 'jobs'> {
  id: string;
  active: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  jobs: TemplateJobRecord[];
}

export interface TemplateJobOption extends TemplateJobRecord {
  templateId: string;
  templateTitle: string;
}

export interface TemplateRepository {
  list(filter: { search?: string; includeInactive: boolean }): Promise<TemplateRecord[]>;
  findById(id: string): Promise<TemplateRecord | null>;
  findJob(id: string): Promise<TemplateJobOption | null>;
  /** Jobs de templates ativos (criar job a partir de template). */
  listJobs(search?: string): Promise<TemplateJobOption[]>;
  create(data: TemplateData, actorId: string): Promise<TemplateRecord>;
  /** Substitui título, briefing e a lista inteira de jobs e tarefas. */
  replace(id: string, data: TemplateData): Promise<TemplateRecord>;
  setActive(id: string, active: boolean): Promise<void>;
  delete(id: string): Promise<void>;
}
