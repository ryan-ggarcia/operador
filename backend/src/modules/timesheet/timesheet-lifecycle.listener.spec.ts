import { BadRequestException } from '@nestjs/common';
import type { AuthFacade } from '../auth/public/index.js';
import type { ProjectsFacade } from '../projects/public/index.js';
import { currentAssignments } from './schedules/schedules.service.js';
import { TimesheetLifecycleListener } from './timesheet-lifecycle.listener.js';
import type {
  DocRef,
  TimeEntryChanges,
  TimeEntryRecord,
  TimeEntryRepository,
} from './repositories/time-entry.repository.js';

function entry(overrides: Partial<TimeEntryRecord>): TimeEntryRecord {
  return {
    id: 'e1',
    userId: 'ana',
    docType: 'JOB',
    docId: 'j1',
    projectId: 'p1',
    clientId: 'c1',
    startedAt: new Date(Date.now() - 30 * 60_000),
    endedAt: null,
    minutes: 0,
    source: 'TIMER',
    kind: 'NORMAL',
    description: null,
    situation: 'RUNNING',
    hourlyCost: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TimesheetLifecycleListener', () => {
  const running = [
    entry({}),
    entry({ id: 'e2', userId: 'joao', docType: 'TASK', docId: 't9', projectId: 'p2' }),
  ];
  const updates: { id: string; changes: TimeEntryChanges }[] = [];
  const repository = {
    findRunning: async (filter: { docs?: DocRef[]; projectId?: string }) =>
      running.filter(
        (item) =>
          (!filter.projectId || item.projectId === filter.projectId) &&
          (!filter.docs ||
            filter.docs.some((doc) => doc.docType === item.docType && doc.docIds.includes(item.docId))),
      ),
    update: async (id: string, changes: TimeEntryChanges) => {
      updates.push({ id, changes });
      return entry({ id, ...changes });
    },
  } as unknown as TimeEntryRepository;
  const auth = {
    getUsers: async (ids: string[]) => ids.map((id) => ({ id, name: id === 'ana' ? 'Ana' : 'João' })),
  } as unknown as AuthFacade;
  const listener = new TimesheetLifecycleListener(repository, {} as ProjectsFacade, auth);

  it('barra concluir job ou tarefa com cronômetro ativo e diz de quem é', async () => {
    await expect(listener.beforeClose({ jobIds: ['j1'], taskIds: [] })).rejects.toThrow(/Ana/);
    await expect(listener.beforeClose({ jobIds: [], taskIds: ['t9'] })).rejects.toBeInstanceOf(BadRequestException);
    await expect(listener.beforeClose({ jobIds: ['j2'], taskIds: ['t1'] })).resolves.toBeUndefined();
  });

  it('arquivar o projeto para os cronômetros dele', async () => {
    await listener.afterProjectClosed('p1', 'gestor');
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('e1');
    expect(updates[0].changes.situation).toBe('DONE');
    expect(updates[0].changes.minutes).toBe(30);
  });
});

describe('currentAssignments', () => {
  it('usa a última jornada que já começou a valer', () => {
    const rows = [
      { userId: 'ana', scheduleId: 'a', validFrom: '2026-01-01' },
      { userId: 'ana', scheduleId: 'b', validFrom: '2026-10-15' },
      { userId: 'joao', scheduleId: 'b', validFrom: '2026-03-01' },
    ];
    const today = currentAssignments(rows, '2026-10-14');
    expect(today.get('ana')).toBe('a');
    expect(today.get('joao')).toBe('b');
    expect(currentAssignments(rows, '2026-10-15').get('ana')).toBe('b');
  });
});
