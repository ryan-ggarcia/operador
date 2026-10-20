import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.js';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { localDate } from '../../shared/time/timezone.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../settings/public/index.js';
import { CLAUDE, type Claude } from './claude.client.js';
import { AiToolsService, type ToolUser } from './tools/ai-tools.service.js';

export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface ChatInput {
  messages: { role: 'user' | 'assistant'; content: string }[];
  context?: { jobId?: string };
}

/** Fixo (sem data nem nome): faz parte do prefixo do cache de prompt. */
export const SYSTEM_PROMPT = [
  'Você é o assistente do operador, o sistema de gestão desta agência de comunicação e publicidade.',
  'Responda sempre em português do Brasil, de forma direta e curta.',
  'Para qualquer dado da agência (jobs, tarefas, horas, financeiro, mídias), use as ferramentas. Nunca invente números, nomes, datas nem valores: se a ferramenta não trouxe, diga que não sabe.',
  'Se uma ferramenta negar o acesso ou não houver ferramenta para o pedido, diga isso ao usuário com clareza.',
  'As ferramentas só leem dados: você não cria nem altera nada no sistema.',
  'Tempos vêm em minutos: mostre em horas e minutos. Valores estão em reais. Datas estão no fuso da agência.',
].join('\n');

const MAX_TOKENS = 64000;
const MAX_ROUNDS = 8;
const MAX_JSON_RETRIES = 2;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const REFUSAL = 'O assistente não pode responder a esse pedido. Tente reformular a pergunta.';
const TOO_MANY_ROUNDS = 'A pergunta precisou de consultas demais. Tente algo mais específico.';
const TRUNCATED = 'A resposta ficou grande demais. Tente uma pergunta mais específica.';

/**
 * Depois de um fallback no meio da resposta, o que veio antes do último bloco
 * `fallback` volta ao histórico só como texto (shared/model-migration.md).
 */
export function echoable(content: BetaContentBlock[]): BetaContentBlock[] {
  const last = content.findLastIndex((block) => block.type === 'fallback');
  if (last < 0) return content;
  return [...content.slice(0, last).filter((block) => block.type === 'text'), ...content.slice(last + 1)];
}

/** Mensagem amigável para os erros da Claude API (sem detalhes internos). */
export function friendlyError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) {
    return 'O assistente recebeu pedidos demais agora. Tente de novo em instantes.';
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return 'A chave da Claude API é inválida ou está sem permissão. Avise o administrador.';
  }
  if (error instanceof Anthropic.BadRequestError) {
    return 'Não foi possível processar esta conversa. Comece uma conversa nova.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Não foi possível falar com a Claude API. Tente de novo.';
  }
  if (error instanceof Anthropic.APIError) {
    return 'A Claude API está indisponível no momento. Tente de novo em instantes.';
  }
  return 'Erro inesperado no assistente. Tente de novo.';
}

/** Conversa com o Claude: streaming e loop manual de ferramentas (só leitura). */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    @Inject(CLAUDE) private readonly claude: Claude | null,
    private readonly tools: AiToolsService,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
  ) {}

  get enabled(): boolean {
    return this.claude !== null;
  }

  async *chat(user: ToolUser, input: ChatInput, signal: AbortSignal): AsyncGenerator<ChatEvent> {
    if (!this.claude) {
      yield { type: 'error', message: 'O assistente não está configurado.' };
      return;
    }
    const { client, model } = this.claude;
    const messages = await this.history(input);
    let jsonRetries = 0;
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (signal.aborted) return;
        const stream = client.beta.messages.stream(
          {
            model,
            max_tokens: MAX_TOKENS,
            betas: [FALLBACK_BETA],
            fallbacks: 'default',
            output_config: { effort: 'medium' },
            cache_control: { type: 'ephemeral' },
            system: SYSTEM_PROMPT,
            tools: this.tools.definitions,
            messages,
          },
          { signal },
        );
        let message;
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              yield { type: 'text', text: event.delta.text };
            }
          }
          message = await stream.finalMessage();
          jsonRetries = 0;
        } catch (error) {
          // Com eager_input_streaming, entrada de ferramenta sem JSON válido rejeita o stream: repete a rodada.
          if (error instanceof Anthropic.APIError || jsonRetries++ >= MAX_JSON_RETRIES) throw error;
          round--;
          continue;
        }

        if (message.stop_reason === 'refusal') {
          yield { type: 'error', message: REFUSAL };
          return;
        }
        const content = echoable(message.content);
        if (message.stop_reason === 'pause_turn') {
          messages.push({ role: 'assistant', content });
          continue;
        }
        const calls = content.filter((block): block is BetaToolUseBlock => block.type === 'tool_use');
        if (message.stop_reason !== 'tool_use' || calls.length === 0) {
          if (message.stop_reason === 'max_tokens' && calls.length) yield { type: 'error', message: TRUNCATED };
          else yield { type: 'done' };
          return;
        }

        messages.push({ role: 'assistant', content });
        for (const call of calls) yield { type: 'tool', label: this.tools.label(call.name) };
        const results = await Promise.all(calls.map((call) => this.tools.run(user, call)));
        messages.push({ role: 'user', content: results });
      }
      yield { type: 'error', message: TOO_MANY_ROUNDS };
    } catch (error) {
      if (signal.aborted || error instanceof Anthropic.APIUserAbortError) return;
      if (!(error instanceof Anthropic.APIError)) {
        this.logger.error('Falha no assistente', error instanceof Error ? error.stack : String(error));
      }
      yield { type: 'error', message: friendlyError(error) };
    }
  }

  /** Histórico em texto; a última mensagem leva a data de hoje e o job em foco. */
  private async history(input: ChatInput): Promise<BetaMessageParam[]> {
    const { timezone } = await this.settings.getAgency();
    const notes = [`[Hoje é ${localDate(new Date(), timezone)} no fuso da agência.]`];
    if (input.context?.jobId) notes.push(`[O usuário está com o job de id ${input.context.jobId} aberto na tela.]`);
    return input.messages.map((message, index) => ({
      role: message.role,
      content:
        index === input.messages.length - 1 ? `${notes.join('\n')}\n\n${message.content}` : message.content,
    }));
  }
}
