'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { ErrorMessage, RichText, UserAvatar } from '@/components/common';
import { useReferenceData } from '@/components/reference-data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { formatDateTime, textToHtml } from '@/lib/format';
import { api } from '@/services';
import type { DocType } from '@/services/types';

/** Comentários (interações) de um projeto ou job. */
export function Comments({ docType, docId }: { docType: DocType; docId: string }) {
  const { user } = useAuth();
  const { user: findUser } = useReferenceData();
  const comments = useResource(() => api.comments.list(docType, docId), [docType, docId]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.comments.create(docType, docId, textToHtml(text));
      setText('');
      await comments.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.comments.remove(id);
      await comments.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage error={comments.error} />
      {comments.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}
      <ul className="flex flex-col gap-4">
        {comments.data?.map((comment) => {
          const author = findUser(comment.authorId);
          return (
            <li key={comment.id} className="flex gap-3">
              <UserAvatar user={author ?? { id: comment.authorId, name: '?', color: null }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{author?.name ?? 'Usuário'}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                  {comment.authorId === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="ml-auto"
                      aria-label="Apagar comentário"
                      onClick={() => void remove(comment.id)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <RichText html={comment.html} />
              </div>
            </li>
          );
        })}
      </ul>
      <form onSubmit={send} className="flex flex-col gap-2">
        <Textarea
          placeholder="Escreva um comentário"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div>
          <Button type="submit" size="sm" disabled={sending || !text.trim()}>
            {sending && <Loader2 className="animate-spin" />}
            Comentar
          </Button>
        </div>
      </form>
    </div>
  );
}
