import { diffFields } from './diff.js';

describe('diffFields', () => {
  const before = {
    title: 'Campanha',
    budget: 10,
    deadline: new Date('2026-10-01T12:00:00Z'),
    hidden: false,
    statusId: null as string | null,
  };

  it('lista só os campos que mudaram, com valor antigo e novo', () => {
    const changes = diffFields(
      before,
      { title: 'Campanha', budget: 12, hidden: true, statusId: 's1' },
      ['title', 'budget', 'deadline', 'hidden', 'statusId'],
    );
    expect(changes).toEqual([
      { field: 'budget', oldValue: '10', newValue: '12' },
      { field: 'hidden', oldValue: 'false', newValue: 'true' },
      { field: 'statusId', oldValue: null, newValue: 's1' },
    ]);
  });

  it('ignora campos fora da lista e valores indefinidos', () => {
    expect(diffFields(before, { title: undefined, deadline: new Date('2026-10-01T12:00:00Z') }, ['title', 'deadline'])).toEqual([]);
  });
});
