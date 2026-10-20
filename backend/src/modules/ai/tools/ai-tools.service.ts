import type { BetaTool, BetaToolResultBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages.js';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { localParts } from '../../../shared/time/timezone.js';
import type { UserPermissions } from '../../auth/public/index.js';
import { CRM_FACADE, type CrmFacade } from '../../crm/public/index.js';
import { FINANCE_FACADE, type FinanceFacade } from '../../finance/public/index.js';
import { MEDIA_FACADE, type MediaFacade } from '../../media/public/index.js';
import { PROJECTS_FACADE, type JobSituation, type ProjectsFacade } from '../../projects/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import { TIMESHEET_FACADE, type TimesheetFacade } from '../../timesheet/public/index.js';
import { jsonSchema, validateInput, type InputSpec } from '../domain/tool-input.js';

/** Quem pergunta: as ferramentas aplicam as mesmas regras de acesso das telas. */
export interface ToolUser {
  id: string;
  access: UserPermissions;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

type Input = Record<string, string | boolean>;

const SITUATIONS = ['aberto', 'concluido', 'cancelado'] as const;
const TO_SITUATION: Record<string, JobSituation> = { aberto: 'OPEN', concluido: 'DONE', cancelado: 'CANCELED' };
const JOB_LIMIT = 20;

const clientFields = {
  cliente: { type: 'text', max: 120, description: 'Nome (ou parte do nome) do cliente.' },
  cliente_id: { type: 'uuid', description: 'Id do cliente, se já souber.' },
} as const;
const situationField = {
  type: 'enum',
  values: SITUATIONS,
  description: 'Situação do documento; sem ela, todas.',
} as const;

/** Ordem fixa: a lista de ferramentas faz parte do prefixo do cache de prompt. */
const TOOLS: { name: string; label: string; description: string; input: InputSpec }[] = [
  {
    name: 'buscar_jobs',
    label: 'Buscando jobs…',
    description:
      'Busca jobs (pautas de trabalho) que o usuário pode ver. Use quando perguntarem por jobs de um cliente, ' +
      'por status, atrasados, por título ou número (ex.: 123.4), ou para achar o id de um job antes de pedir ' +
      'detalhes ou horas. Devolve no máximo 20, com o total encontrado.',
    input: {
      fields: {
        texto: { type: 'text', max: 200, description: 'Parte do título ou número do job (ex.: 123.4).' },
        ...clientFields,
        status: { type: 'text', max: 80, description: 'Parte do nome do status do job.' },
        situacao: situationField,
        atrasados: { type: 'boolean', description: 'Só os atrasados (abertos com prazo vencido).' },
        meus: { type: 'boolean', description: 'Só os jobs em que o usuário está envolvido.' },
      },
      required: [],
    },
  },
  {
    name: 'detalhes_job',
    label: 'Lendo o job…',
    description:
      'Lê um job: projeto, cliente, responsável, status, prazos, estimativa, briefing e tarefas (status, ' +
      'responsável, prazos), com o tempo realizado no job e em cada tarefa. Use quando perguntarem sobre um ' +
      'job específico; sem o id, use buscar_jobs antes.',
    input: { fields: { job_id: { type: 'uuid', description: 'Id do job.' } }, required: ['job_id'] },
  },
  {
    name: 'horas_job',
    label: 'Consultando horas do job…',
    description:
      'Apontamentos de horas (timesheet) de um job: estimado, realizado, saldo, quem apontou, quando e em quê. ' +
      'Use quando perguntarem quanto tempo foi gasto num job, quem trabalhou nele ou se estourou a estimativa.',
    input: { fields: { job_id: { type: 'uuid', description: 'Id do job.' } }, required: ['job_id'] },
  },
  {
    name: 'resumo_financeiro',
    label: 'Consultando o financeiro…',
    description:
      'Resumo do financeiro num período: recebido, a receber, pago, a pagar, vencidos antes do período, ' +
      'transferências, saldo realizado e previsto, e o saldo de hoje de cada conta. Use para perguntas sobre ' +
      'caixa, receitas, despesas, contas a pagar ou a receber e saldo.',
    input: {
      fields: {
        de: { type: 'date', description: 'Primeiro dia do período (AAAA-MM-DD).' },
        ate: { type: 'date', description: 'Último dia do período, inclusive (AAAA-MM-DD).' },
      },
      required: ['de', 'ate'],
    },
  },
  {
    name: 'buscar_midias',
    label: 'Buscando mídias…',
    description:
      'Busca mídias (PIs) que o usuário pode ver, por texto, cliente, projeto, situação ou período de criação, ' +
      'com o valor total e o líquido somados. Use para perguntas sobre PIs, veiculação ou volume de mídia de um ' +
      'cliente ou período. Lista as 20 mais recentes.',
    input: {
      fields: {
        texto: { type: 'text', max: 200, description: 'Parte do título ou número da estimativa.' },
        ...clientFields,
        projeto_id: { type: 'uuid', description: 'Id do projeto (vem em buscar_jobs).' },
        situacao: situationField,
        de: { type: 'date', description: 'Criadas a partir deste dia (AAAA-MM-DD).' },
        ate: { type: 'date', description: 'Criadas até este dia, inclusive (AAAA-MM-DD).' },
      },
      required: [],
    },
  },
];

/** Erro para o Claude (texto que pode chegar ao usuário). */
class ToolError extends Error {}

const pad = (value: number) => String(value).padStart(2, '0');

function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** Ferramentas de leitura do assistente, só pelas fachadas dos outros módulos. */
@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  readonly definitions: BetaTool[] = TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: jsonSchema(tool.input),
    eager_input_streaming: true,
  }));

  constructor(
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
    @Inject(TIMESHEET_FACADE) private readonly timesheet: TimesheetFacade,
    @Inject(FINANCE_FACADE) private readonly finance: FinanceFacade,
    @Inject(MEDIA_FACADE) private readonly media: MediaFacade,
    @Inject(CRM_FACADE) private readonly crm: CrmFacade,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
  ) {}

  label(name: string): string {
    return TOOLS.find((tool) => tool.name === name)?.label ?? 'Consultando…';
  }

  /** Executa uma chamada; nunca lança (erro vira tool_result com is_error). */
  async run(user: ToolUser, call: ToolCall): Promise<BetaToolResultBlockParam> {
    const result = (content: string, isError = false): BetaToolResultBlockParam => ({
      type: 'tool_result',
      tool_use_id: call.id,
      content,
      ...(isError ? { is_error: true } : {}),
    });
    const tool = TOOLS.find((item) => item.name === call.name);
    if (!tool) return result(`Ferramenta desconhecida: ${call.name}.`, true);
    const check = validateInput(tool.input, call.input);
    if (!check.ok) {
      return result(JSON.stringify({ INVALID_INPUT: JSON.stringify(call.input), erro: check.error }), true);
    }
    try {
      const [data, { timezone }] = await Promise.all([this.execute(tool.name, user, check.value), this.settings.getAgency()]);
      return result(this.serialize(data, timezone));
    } catch (error) {
      if (error instanceof HttpException || error instanceof ToolError) return result(error.message, true);
      this.logger.error(`Ferramenta ${call.name} falhou`, error instanceof Error ? error.stack : String(error));
      return result('Falha ao consultar os dados.', true);
    }
  }

  private execute(name: string, user: ToolUser, input: Input): Promise<unknown> {
    switch (name) {
      case 'buscar_jobs':
        return this.searchJobs(user, input);
      case 'detalhes_job':
        return this.jobDetail(user, String(input.job_id));
      case 'horas_job':
        return this.timesheet.getJobHoursForUser(user.id, user.access, String(input.job_id));
      case 'resumo_financeiro':
        return this.finance.getPeriodSummaryForUser(user.id, user.access, String(input.de), nextDay(String(input.ate)));
      default:
        return this.searchMedias(user, input);
    }
  }

  private async searchJobs(user: ToolUser, input: Input) {
    return this.projects.searchJobsForUser(user.id, user.access, {
      search: input.texto as string | undefined,
      clientId: await this.clientId(input),
      statusName: input.status as string | undefined,
      situations: input.situacao ? [TO_SITUATION[input.situacao as string]] : undefined,
      overdue: input.atrasados === true || undefined,
      mine: input.meus === true || undefined,
      limit: JOB_LIMIT,
    });
  }

  /** Detalhe do job com o realizado (o mesmo total que a aba Timesheet mostra a quem vê o job). */
  private async jobDetail(user: ToolUser, jobId: string) {
    const job = await this.projects.getJobDetailForUser(user.id, user.access, jobId);
    const taskIds = job.tasks.map((task) => task.id);
    const [onJob, onTasks] = await Promise.all([
      this.timesheet.getMinutesBySource('job', [job.id]),
      taskIds.length ? this.timesheet.getMinutesBySource('task', taskIds) : Promise.resolve<Record<string, number>>({}),
    ]);
    const tasks = job.tasks.map((task) => ({ ...task, realizedMinutes: onTasks[task.id] ?? 0 }));
    const realized = (onJob[job.id] ?? 0) + tasks.reduce((sum, task) => sum + task.realizedMinutes, 0);
    return { ...job, realizedMinutes: realized, tasks };
  }

  private async searchMedias(user: ToolUser, input: Input) {
    return this.media.searchMediasForUser(user.id, user.access, {
      search: input.texto as string | undefined,
      clientId: await this.clientId(input),
      projectId: input.projeto_id as string | undefined,
      situations: input.situacao ? [TO_SITUATION[input.situacao as string]] : undefined,
      createdFrom: input.de as string | undefined,
      createdTo: input.ate as string | undefined,
    });
  }

  /** Cliente pelo id ou pelo nome (um só; com vários, pede o nome completo). */
  private async clientId(input: Input): Promise<string | undefined> {
    if (input.cliente_id) return String(input.cliente_id);
    if (!input.cliente) return undefined;
    const name = String(input.cliente);
    const found = await this.crm.searchParties('client', name, 6);
    if (found.length === 0) throw new ToolError(`Nenhum cliente ativo com "${name}".`);
    const exact = found.find((party) => party.name.toLowerCase() === name.toLowerCase());
    if (exact || found.length === 1) return (exact ?? found[0]).id;
    throw new ToolError(
      `Mais de um cliente com "${name}": ${found.map((party) => party.name).join('; ')}. Repita com o nome completo.`,
    );
  }

  /** JSON com as datas no fuso da agência ("AAAA-MM-DD HH:mm"). */
  private serialize(data: unknown, timezone: string): string {
    return JSON.stringify(data, function (this: Record<string, unknown>, key, value: unknown) {
      const original = this[key];
      if (!(original instanceof Date)) return value;
      const local = localParts(original, timezone);
      return `${local.year}-${pad(local.month)}-${pad(local.day)} ${pad(local.hour)}:${pad(local.minute)}`;
    });
  }
}
