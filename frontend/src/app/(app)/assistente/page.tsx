'use client';

import { AlertCircle, Loader2, Plus, Send, Square, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { EmptyState, ErrorMessage, Loading, PageHeader } from '@/components/common';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { api } from '@/services';
import type { ChatMessage } from '@/services/ai.service';

const MAX_MESSAGES = 40;
const MAX_LENGTH = 20_000;
const JOB_SUGGESTION = 'Analise este job: prazos, horas e riscos.';

/** Últimas mensagens aceitas pela API: no máximo 40, começando pelo usuário. */
function recent(messages: ChatMessage[]): ChatMessage[] {
  const tail = messages.slice(-MAX_MESSAGES).map((m) => ({ ...m, content: m.content.slice(0, MAX_LENGTH) }));
  return tail[0]?.role === 'user' ? tail : tail.slice(1);
}

function JobFocus({ jobId, onRemove }: { jobId: string; onRemove: () => void }) {
  const job = useResource(() => api.jobs.get(jobId), [jobId]);
  return (
    <Badge variant="outline" className="h-auto gap-1 py-1 pr-1 text-sm font-normal">
      Job em foco: {job.data ? `${job.data.number} ${job.data.title}` : job.error ? 'não encontrado' : '…'}
      <Button variant="ghost" size="icon" className="size-5" aria-label="Remover job em foco" onClick={onRemove}>
        <X className="size-3" />
      </Button>
    </Badge>
  );
}

function Conversation({ initialJobId }: { initialJobId: string | null }) {
  const [jobId, setJobId] = useState(initialJobId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(() => (initialJobId ? JOB_SUGGESTION : ''));
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, error]);

  async function send() {
    const content = draft.trim();
    if (!content || streaming) return;
    const history: ChatMessage[] = [...messages, { role: 'user', content }];
    const abort = new AbortController();
    controller.current = abort;
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setError(null);
    setStreaming(true);

    let failure: string | null = null;
    let received = false;
    try {
      await api.ai.chat(
        { messages: recent(history), ...(jobId ? { context: { jobId } } : {}) },
        (event) => {
          if (abort.signal.aborted) return;
          if (event.type === 'text') {
            // Texto vazio não conta: um assistente vazio no histórico faz o back recusar (400).
            if (!event.text) return;
            received = true;
            setTool(null);
            setMessages((current) => [
              ...current.slice(0, -1),
              { role: 'assistant', content: current[current.length - 1].content + event.text },
            ]);
          } else if (event.type === 'tool') {
            setTool(event.label);
          } else if (event.type === 'error') {
            failure = event.message;
          }
        },
        abort.signal,
      );
    } catch (caught) {
      if (!abort.signal.aborted) failure = (caught as Error).message;
    }
    if (controller.current !== abort) return; // "Nova conversa" já limpou tudo.

    if (!received) {
      // Sem resposta: tira a pergunta da conversa e devolve o texto à caixa.
      setMessages(messages);
      setDraft((current) => current || content);
      if (!failure && !abort.signal.aborted) failure = 'O assistente não respondeu. Tente de novo.';
    }
    setError(failure);
    setTool(null);
    setStreaming(false);
    controller.current = null;
  }

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setStreaming(false);
    setTool(null);
    setMessages([]);
    setError(null);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {jobId && <JobFocus jobId={jobId} onRemove={() => setJobId(null)} />}
        <div className="flex-1" />
        <Button variant="outline" onClick={reset} disabled={!messages.length && !error && !streaming}>
          <Plus /> Nova conversa
        </Button>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-busy={streaming}
        aria-label="Mensagens"
        className="flex min-h-64 flex-col gap-3 rounded-lg border p-4"
      >
        {!messages.length && !error && (
          <EmptyState>Pergunte sobre jobs, horas, mídias e o financeiro da agência.</EmptyState>
        )}
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <div
              key={index}
              className="max-w-[85%] self-end rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground"
            >
              <span className="sr-only">Você: </span>
              {message.content}
            </div>
          ) : (
            <div
              key={index}
              className="max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
            >
              <span className="sr-only">Assistente: </span>
              {message.content ||
                (streaming && index === messages.length - 1 && (
                  <span className="text-muted-foreground">Pensando…</span>
                ))}
            </div>
          ),
        )}
        {tool && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> {tool}
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div ref={end} />
      </div>

      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Label htmlFor="question" className="sr-only">
          Pergunta ao assistente
        </Label>
        <Textarea
          id="question"
          rows={3}
          maxLength={MAX_LENGTH}
          placeholder="Escreva sua pergunta. Enter envia, Shift+Enter quebra a linha."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            As perguntas e os dados consultados pelo assistente são enviados à Anthropic.
          </p>
          {streaming ? (
            <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>
              <Square /> Parar
            </Button>
          ) : (
            <Button type="submit" disabled={!draft.trim()}>
              <Send /> Enviar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Assistant() {
  const job = useSearchParams().get('job');
  const status = useResource(() => api.ai.status(), []);

  if (status.loading && !status.data) return <Loading />;
  if (!status.data) return <ErrorMessage error={status.error} />;
  if (!status.data.enabled)
    return <EmptyState>Assistente não configurado (falta ANTHROPIC_API_KEY no servidor).</EmptyState>;
  // Abrir com outro job começa uma conversa nova.
  return <Conversation key={job ?? ''} initialJobId={job} />;
}

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Assistente" description="Análises de jobs, relatórios e dados do operador com o Claude." />
      <Suspense fallback={<Loading />}>
        <Assistant />
      </Suspense>
    </div>
  );
}
