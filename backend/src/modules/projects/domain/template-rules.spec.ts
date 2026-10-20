import { MAX_TEMPLATE_JOBS, normalizeTemplate, withActiveReferences } from './template-rules.js';

const job = (title: string, tasks: string[] = []) => ({
  title,
  responsibleId: null,
  statusId: null,
  briefing: null,
  tasks: tasks.map((task) => ({ title: task, responsibleId: null })),
});

describe('template-rules', () => {
  it('tira espaços e exige títulos', () => {
    const template = normalizeTemplate({ title: '  Campanha ', briefing: null, jobs: [job(' Criação ', [' Rascunho '])] });
    expect(template.title).toBe('Campanha');
    expect(template.jobs[0]!.title).toBe('Criação');
    expect(template.jobs[0]!.tasks[0]!.title).toBe('Rascunho');
    expect(() => normalizeTemplate({ title: ' ', briefing: null, jobs: [] })).toThrow('título do template');
    expect(() => normalizeTemplate({ title: 'X', briefing: null, jobs: [job(' ')] })).toThrow('job 1');
    expect(() => normalizeTemplate({ title: 'X', briefing: null, jobs: [job('A', [' '])] })).toThrow('tarefa sem título');
    const many = Array.from({ length: MAX_TEMPLATE_JOBS + 1 }, (_, index) => job(`J${index}`));
    expect(() => normalizeTemplate({ title: 'X', briefing: null, jobs: many })).toThrow('no máximo');
  });

  it('troca referências inativas por vazio', () => {
    const cleaned = withActiveReferences(
      {
        ...job('A'),
        responsibleId: 'saiu',
        statusId: 'velho',
        tasks: [
          { title: 't1', responsibleId: 'ana' },
          { title: 't2', responsibleId: 'saiu' },
        ],
      },
      new Set(['ana']),
      new Set(['novo']),
    );
    expect(cleaned.responsibleId).toBeNull();
    expect(cleaned.statusId).toBeNull();
    expect(cleaned.tasks.map((task) => task.responsibleId)).toEqual(['ana', null]);
  });
});
