import type { JobRecord, JobRepository } from '../repositories/job.repository.js';

/**
 * Jobs não cancelados de um projeto, na ordem do número. Uso interno das
 * cópias (template e duplicação), depois de conferido o acesso ao projeto.
 */
export async function projectJobs(jobs: JobRepository, projectId: string, actorId: string): Promise<JobRecord[]> {
  const page = await jobs.list({
    visibility: { userId: actorId, readAll: true, allHidden: true },
    projectId,
    situations: ['OPEN', 'DONE'],
    orderBy: 'number',
    limit: 1000,
    offset: 0,
  });
  return [...page.items].sort((a, b) => a.sequence - b.sequence);
}
