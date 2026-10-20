import { Logger, NotFoundException } from '@nestjs/common';
import { makePermissions } from '../../auth/public/testing.js';
import type { CrmFacade } from '../../crm/public/index.js';
import type { ProjectsFacade } from '../../projects/public/index.js';
import { AiToolsService } from './ai-tools.service.js';

const JOB_ID = '7f1c2a9e-1b2c-4d3e-8f90-123456789abc';
const user = { id: 'u1', access: makePermissions({ jobs: 6 }) };

function setup(projects: Partial<ProjectsFacade>, crm: Partial<CrmFacade> = {}) {
  const settings = { getAgency: async () => ({ timezone: 'America/Sao_Paulo' }) };
  const timesheet = { getMinutesBySource: async () => ({}) };
  return new AiToolsService(projects as never, timesheet as never, {} as never, {} as never, crm as never, settings as never);
}

describe('AiToolsService', () => {
  it('entrada inválida vira tool_result com is_error, sem consultar o módulo', async () => {
    const getJobDetailForUser = vi.fn();
    const tools = setup({ getJobDetailForUser });
    const result = await tools.run(user, { id: 't1', name: 'detalhes_job', input: { job_id: '12"3' } });
    expect(result).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: true });
    expect(JSON.parse(result.content as string)).toEqual({ INVALID_INPUT: '{"job_id":"12\\"3"}', erro: 'job_id não é um id válido.' });
    expect(getJobDetailForUser).not.toHaveBeenCalled();
  });

  it('o que a fachada nega ao usuário volta como erro, com a mensagem da tela', async () => {
    const tools = setup({
      getJobDetailForUser: async () => {
        throw new NotFoundException('Job não encontrado.');
      },
    });
    const result = await tools.run(user, { id: 't2', name: 'detalhes_job', input: { job_id: JOB_ID } });
    expect(result).toEqual({ type: 'tool_result', tool_use_id: 't2', content: 'Job não encontrado.', is_error: true });
  });

  it('erro interno não vaza detalhes; ferramenta desconhecida é erro', async () => {
    const tools = setup({
      getJobDetailForUser: async () => {
        throw new Error('connection refused em 10.0.0.5');
      },
    });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const internal = await tools.run(user, { id: 't3', name: 'detalhes_job', input: { job_id: JOB_ID } });
    expect(internal).toMatchObject({ content: 'Falha ao consultar os dados.', is_error: true });
    expect(await tools.run(user, { id: 't4', name: 'apagar_tudo', input: {} })).toMatchObject({ is_error: true });
  });

  it('busca de jobs: cliente pelo nome exato, filtros traduzidos e datas no fuso da agência', async () => {
    const searchJobsForUser = vi.fn(async () => ({
      total: 1,
      items: [{ id: 'j1', deadline: new Date('2026-10-21T02:59:59.999Z') }],
    }));
    const searchParties = vi.fn(async () => [
      { id: 'c2', name: 'Acme Filial' },
      { id: 'c1', name: 'Acme' },
    ]);
    const tools = setup({ searchJobsForUser } as never, { searchParties } as never);
    const result = await tools.run(user, {
      id: 't5',
      name: 'buscar_jobs',
      input: { cliente: 'acme', situacao: 'aberto', atrasados: true },
    });
    expect(searchJobsForUser).toHaveBeenCalledWith('u1', user.access, expect.objectContaining({
      clientId: 'c1',
      situations: ['OPEN'],
      overdue: true,
      limit: 20,
    }));
    expect(JSON.parse(result.content as string).items[0].deadline).toBe('2026-10-20 23:59');
  });

  it('nome de cliente ambíguo pede o nome completo', async () => {
    const searchParties = async () => [
      { id: 'c1', name: 'Acme Brasil' },
      { id: 'c2', name: 'Acme Filial' },
    ];
    const tools = setup({ searchJobsForUser: vi.fn() } as never, { searchParties } as never);
    const result = await tools.run(user, { id: 't6', name: 'buscar_jobs', input: { cliente: 'acme' } });
    expect(result).toMatchObject({ is_error: true, content: expect.stringContaining('Acme Brasil; Acme Filial') });
  });

  it('ferramentas com eager_input_streaming e schema fechado, em ordem fixa', () => {
    const tools = setup({});
    expect(tools.definitions.map((tool) => tool.name)).toEqual([
      'buscar_jobs', 'detalhes_job', 'horas_job', 'resumo_financeiro', 'buscar_midias',
    ]);
    for (const tool of tools.definitions) {
      expect(tool.eager_input_streaming).toBe(true);
      expect(tool.input_schema.additionalProperties).toBe(false);
    }
    expect(tools.label('horas_job')).toBe('Consultando horas do job…');
  });
});
