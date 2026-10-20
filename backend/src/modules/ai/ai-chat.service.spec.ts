import type { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/beta/messages/messages.js';
import { makePermissions } from '../auth/public/testing.js';
import { AiController } from './ai.controller.js';
import { AiChatService, echoable, type ChatEvent } from './ai-chat.service.js';
import { claudeProvider, type ClaudeClient, type ClaudeStream } from './claude.client.js';
import { AiToolsService } from './tools/ai-tools.service.js';

const JOB_ID = '7f1c2a9e-1b2c-4d3e-8f90-123456789abc';
const settings = { getAgency: async () => ({ timezone: 'America/Sao_Paulo' }) };
const user = { id: 'u1', access: makePermissions({ jobs: 6 }) };

/** Uma rodada: os eventos do stream e a mensagem final. */
interface Round {
  texts: string[];
  final: Record<string, unknown>;
}

function fakeClient(rounds: Round[]) {
  const calls: MessageCreateParamsBase[] = [];
  const client: ClaudeClient = {
    beta: {
      messages: {
        stream(body) {
          // Copia: o serviço continua mexendo no histórico depois da chamada.
          calls.push(structuredClone(body));
          const round = rounds[calls.length - 1];
          const stream: ClaudeStream = {
            async *[Symbol.asyncIterator]() {
              for (const text of round.texts) {
                yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } } as never;
              }
            },
            finalMessage: async () => round.final as never,
          };
          return stream;
        },
      },
    },
  };
  return { client, calls };
}

function setup(rounds: Round[]) {
  const { client, calls } = fakeClient(rounds);
  const getJobDetailForUser = vi.fn(async () => ({ id: JOB_ID, title: 'Campanha', tasks: [] }));
  const tools = new AiToolsService(
    { getJobDetailForUser } as never,
    { getMinutesBySource: async () => ({ [JOB_ID]: 30 }) } as never,
    {} as never,
    {} as never,
    {} as never,
    settings as never,
  );
  const service = new AiChatService({ client, model: 'claude-opus-5-5' }, tools, settings as never);
  return { service, calls, getJobDetailForUser };
}

async function collect(service: AiChatService, signal = new AbortController().signal): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  const input = { messages: [{ role: 'user' as const, content: 'Como está o job?' }], context: { jobId: JOB_ID } };
  for await (const event of service.chat(user, input, signal)) events.push(event);
  return events;
}

const toolRound: Round = {
  texts: ['Vou olhar.'],
  final: {
    stop_reason: 'tool_use',
    content: [
      { type: 'text', text: 'Vou olhar.' },
      { type: 'tool_use', id: 'tu1', name: 'detalhes_job', input: { job_id: JOB_ID } },
      { type: 'tool_use', id: 'tu2', name: 'horas_job', input: { job_id: 'invalido' } },
    ],
  },
};
const finalRound: Round = {
  texts: ['O job ', 'está em dia.'],
  final: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'O job está em dia.' }] },
};

describe('AiChatService: loop de ferramentas', () => {
  it('roda todas as ferramentas da rodada, devolve os resultados juntos e termina na resposta final', async () => {
    const { service, calls, getJobDetailForUser } = setup([toolRound, finalRound]);
    const events = await collect(service);

    expect(events).toEqual([
      { type: 'text', text: 'Vou olhar.' },
      { type: 'tool', label: 'Lendo o job…' },
      { type: 'tool', label: 'Consultando horas do job…' },
      { type: 'text', text: 'O job ' },
      { type: 'text', text: 'está em dia.' },
      { type: 'done' },
    ]);
    expect(getJobDetailForUser).toHaveBeenCalledWith('u1', user.access, JOB_ID);
    expect(calls).toHaveLength(2);

    const [first, second] = calls;
    expect(first).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
    });
    expect(first).not.toHaveProperty('thinking');
    expect(first).not.toHaveProperty('tool_choice');
    expect(first.messages).toHaveLength(1);
    expect(first.messages[0].content).toContain(`job de id ${JOB_ID}`);
    expect(first.messages[0].content).toMatch(/\[Hoje é \d{4}-\d{2}-\d{2}/);

    // O assistente volta com o conteúdo inteiro (tool_use incluído) e os dois resultados numa só mensagem.
    expect(second.messages[1]).toEqual({ role: 'assistant', content: toolRound.final.content });
    const results = second.messages[2];
    expect(results.role).toBe('user');
    expect(results.content).toMatchObject([
      { type: 'tool_result', tool_use_id: 'tu1' },
      { type: 'tool_result', tool_use_id: 'tu2', is_error: true },
    ]);
    expect((results.content as { is_error?: boolean }[])[0].is_error).toBeUndefined();
    expect(second.system).toBe(first.system);
    expect(second.tools).toEqual(first.tools);
  });

  it('recusa vira mensagem amigável e não executa as ferramentas da rodada', async () => {
    const { service, getJobDetailForUser } = setup([
      { texts: [], final: { stop_reason: 'refusal', content: toolRound.final.content } },
    ]);
    const events = await collect(service);
    expect(events.at(-1)).toEqual({ type: 'error', message: expect.stringContaining('não pode responder') });
    expect(getJobDetailForUser).not.toHaveBeenCalled();
  });

  it('para no limite de rodadas', async () => {
    const { service, calls } = setup(Array.from({ length: 8 }, () => toolRound));
    const events = await collect(service);
    expect(calls).toHaveLength(8);
    expect(events.at(-1)).toEqual({ type: 'error', message: expect.stringContaining('consultas demais') });
  });

  it('cliente desconectado: não chama a API', async () => {
    const { service, calls } = setup([finalRound]);
    const abort = new AbortController();
    abort.abort();
    expect(await collect(service, abort.signal)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('depois de um fallback, o que veio antes volta ao histórico só como texto', () => {
    const content = [
      { type: 'thinking', thinking: '', signature: 's' },
      { type: 'text', text: 'parcial' },
      { type: 'tool_use', id: 'x', name: 'buscar_jobs', input: {} },
      { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } },
      { type: 'text', text: 'resto' },
    ] as never;
    expect(echoable(content)).toEqual([
      { type: 'text', text: 'parcial' },
      { type: 'text', text: 'resto' },
    ]);
  });
});

describe('sem ANTHROPIC_API_KEY', () => {
  it('o cliente não é criado e o status diz desligado', () => {
    const factory = (claudeProvider as { useFactory: (config: unknown) => unknown }).useFactory;
    const claude = factory({ get: () => undefined });
    expect(claude).toBeNull();
    const service = new AiChatService(null, {} as never, settings as never);
    expect(new AiController(service).status()).toEqual({ enabled: false });
  });

  it('com a chave, usa o modelo padrão ou o de AI_MODEL', () => {
    const factory = (claudeProvider as { useFactory: (config: unknown) => { model: string } }).useFactory;
    const env = (values: Record<string, string>) => ({ get: (key: string) => values[key] });
    expect(factory(env({ ANTHROPIC_API_KEY: 'sk-teste' })).model).toBe('claude-opus-5-5');
    expect(factory(env({ ANTHROPIC_API_KEY: 'sk-teste', AI_MODEL: 'outro' })).model).toBe('outro');
  });
});
