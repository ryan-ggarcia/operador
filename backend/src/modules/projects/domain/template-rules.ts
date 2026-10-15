/**
 * Templates de projeto (docs/operand/projetos.md, 2.4 e regras 20–21): um
 * template tem título, briefing e uma lista ordenada de jobs; cada job tem
 * título, responsável, status, briefing e tarefas.
 */

export class TemplateRuleError extends Error {}

export const MAX_TEMPLATE_JOBS = 100;
export const MAX_TEMPLATE_TASKS = 100;

export interface TemplateTaskData {
  title: string;
  responsibleId: string | null;
}

export interface TemplateJobData {
  title: string;
  responsibleId: string | null;
  statusId: string | null;
  briefing: string | null;
  tasks: TemplateTaskData[];
}

export interface TemplateData {
  title: string;
  briefing: string | null;
  jobs: TemplateJobData[];
}

/** Tira espaços, exige títulos e limita o tamanho. */
export function normalizeTemplate(input: TemplateData): TemplateData {
  const title = input.title.trim();
  if (!title) throw new TemplateRuleError('Informe o título do template.');
  if (input.jobs.length > MAX_TEMPLATE_JOBS) {
    throw new TemplateRuleError(`Um template pode ter no máximo ${MAX_TEMPLATE_JOBS} jobs.`);
  }
  return {
    title: title.slice(0, 250),
    briefing: input.briefing,
    jobs: input.jobs.map((job, index) => {
      const jobTitle = job.title.trim();
      if (!jobTitle) throw new TemplateRuleError(`Informe o título do job ${index + 1} do template.`);
      if (job.tasks.length > MAX_TEMPLATE_TASKS) {
        throw new TemplateRuleError(`Um job de template pode ter no máximo ${MAX_TEMPLATE_TASKS} tarefas.`);
      }
      return {
        ...job,
        title: jobTitle.slice(0, 250),
        tasks: job.tasks.map((task) => {
          const taskTitle = task.title.trim();
          if (!taskTitle) throw new TemplateRuleError(`Há tarefa sem título no job "${jobTitle}".`);
          return { ...task, title: taskTitle.slice(0, 250) };
        }),
      };
    }),
  };
}

/**
 * Ao aplicar um template antigo, responsáveis desativados e status
 * inativos viram "sem responsável" e "sem status", em vez de travar a
 * criação dos jobs.
 */
export function withActiveReferences(
  job: TemplateJobData,
  activeUserIds: ReadonlySet<string>,
  activeStatusIds: ReadonlySet<string>,
): TemplateJobData {
  const user = (id: string | null) => (id && activeUserIds.has(id) ? id : null);
  return {
    ...job,
    responsibleId: user(job.responsibleId),
    statusId: job.statusId && activeStatusIds.has(job.statusId) ? job.statusId : null,
    tasks: job.tasks.map((task) => ({ ...task, responsibleId: user(task.responsibleId) })),
  };
}
