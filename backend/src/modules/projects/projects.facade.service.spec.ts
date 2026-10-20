import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { makePermissions } from '../auth/public/testing.js';
import { JobsService } from './jobs/jobs.service.js';
import { ProjectsFacadeService } from './projects.facade.service.js';
import type { JobRecord, JobRepository } from './repositories/job.repository.js';
import type { StatusRepository } from './repositories/status.repository.js';

/** Job de projeto oculto em que só "resp" está envolvido. */
const hiddenJob = {
  id: 'j1',
  situation: 'OPEN',
  responsibleId: 'resp',
  requesterId: null,
  memberIds: [],
  projectHidden: true,
  projectInvolvedIds: [],
} as unknown as JobRecord;

function setup() {
  const list = vi.fn(async () => ({ items: [], total: 0 }));
  const jobs = { findById: async () => hiddenJob, list } as unknown as JobRepository;
  const statuses = { list: async () => [{ id: 's1', name: 'Em criação', active: true }] } as unknown as StatusRepository;
  const naming = { resolve: async () => ({ client: () => null, contact: () => null, user: () => null, users: () => [] }) };
  const jobService = new JobsService(jobs, {} as never, statuses, {} as never, naming as never, {} as never, {} as never);
  const facade = new ProjectsFacadeService({} as never, jobs, statuses, {} as never, jobService, {} as never);
  return { facade, list };
}

describe('ProjectsFacadeService: leitura para o assistente', () => {
  it('job de projeto oculto não sai para quem não é envolvido (nem com nível Total)', async () => {
    const { facade } = setup();
    await expect(facade.getJobDetailForUser('outro', makePermissions({ jobs: 6 }), 'j1')).rejects.toThrow(NotFoundException);
  });

  it('sem acesso a jobs a busca é negada; com acesso, usa a visibilidade da pauta', async () => {
    const { facade, list } = setup();
    await expect(facade.searchJobsForUser('outro', makePermissions({}), { limit: 20 })).rejects.toThrow(ForbiddenException);
    expect(list).not.toHaveBeenCalled();
    await facade.searchJobsForUser('outro', makePermissions({ jobs: 1 }), { statusName: 'criação', limit: 20 });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: ['s1'], visibility: { userId: 'outro', readAll: false, allHidden: false } }),
    );
  });

  it('status inexistente explica quais existem', async () => {
    const { facade } = setup();
    await expect(facade.searchJobsForUser('outro', makePermissions({ jobs: 2 }), { statusName: 'xyz', limit: 20 }))
      .rejects.toThrow('Status: Em criação.');
  });
});
