import { jsonSchema, validateInput, type InputSpec } from './tool-input.js';

const spec: InputSpec = {
  fields: {
    job_id: { type: 'uuid', description: 'Id.' },
    texto: { type: 'text', max: 5, description: 'Texto.' },
    de: { type: 'date', description: 'Data.' },
    situacao: { type: 'enum', values: ['aberto', 'concluido'], description: 'Situação.' },
    meus: { type: 'boolean', description: 'Meus.' },
  },
  required: ['job_id'],
};
const id = '7f1c2a9e-1b2c-4d3e-8f90-123456789abc';

describe('entrada das ferramentas do assistente', () => {
  it('aceita a entrada válida, tira espaços e ignora vazios', () => {
    expect(validateInput(spec, { job_id: id, texto: ' ab ', de: '2026-10-20', situacao: 'aberto', meus: true }))
      .toEqual({ ok: true, value: { job_id: id, texto: 'ab', de: '2026-10-20', situacao: 'aberto', meus: true } });
    expect(validateInput(spec, { job_id: id, texto: '' })).toEqual({ ok: true, value: { job_id: id } });
  });

  it('recusa campo desconhecido', () => {
    expect(validateInput(spec, { job_id: id, ate: '2026-10-20' })).toEqual({ ok: false, error: 'Campo desconhecido: ate.' });
  });

  it('recusa tipo errado, id inválido, data impossível, valor fora da lista e obrigatório faltando', () => {
    const error = (input: unknown) => {
      const check = validateInput(spec, input);
      return check.ok ? null : check.error;
    };
    expect(error('texto')).toBe('A entrada precisa ser um objeto.');
    expect(error({ job_id: 'abc' })).toContain('id válido');
    expect(error({ job_id: id, de: '2026-02-30' })).toContain('AAAA-MM-DD');
    expect(error({ job_id: id, situacao: 'todos' })).toContain('aberto, concluido');
    expect(error({ job_id: id, meus: 'sim' })).toContain('true ou false');
    expect(error({ job_id: id, texto: 'longo demais' })).toContain('5 caracteres');
    expect(error({ job_id: 42 })).toContain('texto');
    expect(error({})).toBe('Faltou: job_id.');
  });

  it('gera o JSON Schema fechado com os mesmos campos', () => {
    const schema = jsonSchema(spec);
    expect(schema.required).toEqual(['job_id']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.situacao).toEqual({ type: 'string', description: 'Situação.', enum: ['aberto', 'concluido'] });
  });
});
