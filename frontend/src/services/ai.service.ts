import type { HttpClient } from './http';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context?: { jobId?: string };
}

export type ChatEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** Separa os eventos `data: <json>` de um texto SSE; devolve o resto incompleto. */
export function parseSse(buffer: string, onEvent: (event: ChatEvent) => void): string {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (data) onEvent(JSON.parse(data) as ChatEvent);
  }
  return rest;
}

export class AiService {
  constructor(private readonly http: HttpClient) {}

  status() {
    return this.http.get<{ enabled: boolean }>('/ai/status');
  }

  /** Conversa com o assistente; os eventos chegam aos poucos em `onEvent`. */
  async chat(body: ChatRequest, onEvent: (event: ChatEvent) => void, signal: AbortSignal): Promise<void> {
    const reader = (await this.http.stream('/ai/chat', body, signal)).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = parseSse(buffer + decoder.decode(value, { stream: true }), onEvent);
    }
    parseSse(`${buffer}${decoder.decode()}\n\n`, onEvent);
  }
}
