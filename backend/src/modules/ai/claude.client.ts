import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessage,
  BetaRawMessageStreamEvent,
  MessageCreateParamsBase,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.js';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Token de injeção do cliente da Claude API (nulo sem ANTHROPIC_API_KEY). */
export const CLAUDE = Symbol('CLAUDE');

export const DEFAULT_MODEL = 'claude-opus-5-5';

/** O pedaço do SDK que o assistente usa (o teste injeta um falso). */
export interface ClaudeStream extends AsyncIterable<BetaRawMessageStreamEvent> {
  finalMessage(): Promise<BetaMessage>;
}

export interface ClaudeClient {
  beta: { messages: { stream(body: MessageCreateParamsBase, options?: { signal?: AbortSignal }): ClaudeStream } };
}

export interface Claude {
  client: ClaudeClient;
  model: string;
}

export const claudeProvider: Provider = {
  provide: CLAUDE,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Claude | null => {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) return null;
    return { client: new Anthropic({ apiKey }), model: config.get<string>('AI_MODEL') || DEFAULT_MODEL };
  },
};
