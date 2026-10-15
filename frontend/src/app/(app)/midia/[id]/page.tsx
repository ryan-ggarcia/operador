'use client';

import { CheckCircle2, Plus, RotateCcw, Send, Trash2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Attachments } from '@/components/attachments';
import { ErrorMessage, Loading, PageHeader, SituationBadge, UserAvatar, UserList } from '@/components/common';
import { MediaGridCard } from '@/components/media/media-grid';
import { MediaTerms } from '@/components/media/media-terms';
import { MediaTotalsPanel } from '@/components/media/media-totals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useResource } from '@/hooks/use-resource';
import { formatDate, formatDeadline } from '@/lib/format';
import { api } from '@/services';
import { MEDIA_TYPE_LABEL, type Media } from '@/services/media.service';

function Pieces({ media, onChange }: { media: Media; onChange: (media: Media) => void }) {
  const [title, setTitle] = useState('');

  async function run(action: () => Promise<Media>) {
    try {
      onChange(await action());
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {media.pieces.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma peça.</p>}
      {media.pieces.map((piece) => (
        <div key={piece.id} className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="w-8 justify-center">
            {piece.letter}
          </Badge>
          <span className="flex-1">{piece.title}</span>
          {media.can.edit && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Excluir peça"
              onClick={() => void run(() => api.media.removePiece(media.id, piece.id))}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
      {media.can.edit && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            void run(() => api.media.addPiece(media.id, title)).then(() => setTitle(''));
          }}
        >
          <Input placeholder="Nova peça (ex.: vídeo 15s)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" variant="outline" size="icon" aria-label="Adicionar peça">
            <Plus />
          </Button>
        </form>
      )}
    </div>
  );
}

export default function MediaPage() {
  const { id } = useParams<{ id: string }>();
  const media = useResource(() => api.media.get(id), [id]);
  const programs = useResource(() => {
    const type = media.data?.mediaType;
    return type === 'TV' || type === 'RADIO' ? api.media.programs({ mediaType: type }) : Promise.resolve([]);
  }, [media.data?.mediaType]);
  const markets = useResource(() => api.media.markets(), []);
  const costMetrics = useResource(() => api.media.costMetrics(), []);
  const statuses = useResource(() => api.media.statuses(), []);
  const [acting, setActing] = useState(false);

  async function act(action: 'complete' | 'cancel' | 'reopen') {
    setActing(true);
    try {
      media.setData(await api.media.act(id, action));
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function billing(action: 'send' | 'reopen') {
    setActing(true);
    try {
      media.setData(action === 'send' ? await api.media.sendToFinance(id) : await api.media.reopenBilling(id));
      toast.success(action === 'send' ? 'Faturas enviadas ao financeiro.' : 'Faturamento reaberto.');
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function addGrid() {
    try {
      media.setData(await api.media.addGrid(id, {}));
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  if (media.loading && !media.data) return <Loading />;
  if (!media.data) return <ErrorMessage error={media.error} />;
  const data = media.data;
  const status = statuses.data?.find((item) => item.id === data.statusId);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{MEDIA_TYPE_LABEL[data.mediaType]}</Badge>
            <span className="text-muted-foreground tabular-nums">{data.number}</span> {data.title}
            <SituationBadge situation={data.situation} />
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
                <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                {status.name}
              </span>
            )}
          </span>
        }
        description={
          <>
            {data.client?.name}
            {data.project && (
              <>
                {' · '}
                <Link href={`/projetos/${data.project.id}`} className="hover:underline">
                  {data.project.number} {data.project.title}
                </Link>
              </>
            )}
          </>
        }
        actions={
          data.can.act &&
          (data.situation === 'OPEN' ? (
            <>
              {data.sentToFinanceAt ? (
                <Button
                  variant="outline"
                  disabled={acting}
                  onClick={() =>
                    confirm('Reabrir o faturamento cancela as faturas da mídia no financeiro. Continuar?') &&
                    void billing('reopen')
                  }
                >
                  <RotateCcw /> Reabrir faturamento
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={acting || !data.billingType}
                  onClick={() =>
                    confirm('Enviar as faturas ao financeiro? A mídia fica travada até reabrir o faturamento.') &&
                    void billing('send')
                  }
                >
                  <Send /> Enviar ao financeiro
                </Button>
              )}
              <Button variant="outline" disabled={acting} onClick={() => void act('cancel')}>
                <XCircle /> Cancelar
              </Button>
              <Button disabled={acting} onClick={() => void act('complete')}>
                <CheckCircle2 /> Concluir
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={acting} onClick={() => void act('reopen')}>
              <RotateCcw /> Reabrir
            </Button>
          ))
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Veículo e condições</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaTerms key={data.updatedAt} media={data} onSaved={media.setData} />
            </CardContent>
          </Card>

          {data.grids.map((grid) => (
            <MediaGridCard
              key={grid.id}
              media={data}
              grid={grid}
              markets={markets.data ?? []}
              programs={programs.data ?? []}
              costMetrics={costMetrics.data ?? []}
              onChange={media.setData}
            />
          ))}
          {data.can.edit && (
            <div>
              <Button variant="outline" onClick={() => void addGrid()}>
                <Plus /> Adicionar grade
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Totais e faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              <MediaTotalsPanel media={data} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Peças</CardTitle>
            </CardHeader>
            <CardContent>
              <Pieces media={data} onChange={media.setData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Anexos</CardTitle>
            </CardHeader>
            <CardContent>
              <Attachments ownerType="media" ownerId={data.id} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3 text-sm">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Responsável</span>
                <span className="flex items-center gap-2">
                  <UserAvatar user={data.responsible} size="sm" /> {data.responsible?.name}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Envolvidos</span>
                <UserList users={data.members} />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Prazo</span>
                <span className={data.overdue ? 'font-medium text-destructive' : ''}>
                  {formatDeadline(data.deadline, false)}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Criada em</span>
                {formatDate(data.createdAt)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
