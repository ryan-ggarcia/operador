'use client';

import { Loader2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState, ErrorMessage, Loading, PageHeader, StatusBadge, UserAvatar } from '@/components/common';
import { PartyPicker, UserSelect } from '@/components/pickers';
import { useReferenceData } from '@/components/reference-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { formatDeadline, formatMoney } from '@/lib/format';
import { api } from '@/services';
import { MEDIA_TYPE_LABEL, type MediaSituation, type MediaType } from '@/services/media.service';
import type { NamedRef } from '@/services/types';

const SITUATIONS: Record<string, MediaSituation[] | undefined> = {
  open: ['OPEN'],
  done: ['DONE'],
  canceled: ['CANCELED'],
  all: undefined,
};

function NewMediaDialog({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const { users } = useReferenceData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('INTERNET');
  const [client, setClient] = useState<NamedRef | null>(null);
  const [vehicle, setVehicle] = useState<NamedRef | null>(null);
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!client) {
      toast.error('Escolha o cliente.');
      return;
    }
    setSaving(true);
    try {
      const media = await api.media.create({
        title,
        mediaType,
        clientId: client.id,
        vehicleId: vehicle?.id ?? null,
        responsibleId,
        deadline: deadline || null,
      });
      toast.success(`Mídia ${media.number} criada.`);
      setOpen(false);
      onCreated();
      router.push(`/midia/${media.id}`);
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nova mídia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Nova mídia</DialogTitle>
          <DialogDescription>Sem projeto, a mídia vai para o projeto Geral do cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="media-title">Título</Label>
            <Input id="media-title" required maxLength={250} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Tipo de mídia</Label>
              <Select value={mediaType} onValueChange={(value) => setMediaType(value as MediaType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MEDIA_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="media-deadline">Prazo</Label>
              <Input id="media-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <PartyPicker role="client" value={client} onChange={setClient} placeholder="Escolha o cliente" />
          </div>
          <div className="grid gap-2">
            <Label>Veículo</Label>
            <PartyPicker role="vehicle" value={vehicle} onChange={setVehicle} placeholder="Pode escolher depois" />
          </div>
          <div className="grid gap-2">
            <Label>Responsável</Label>
            <UserSelect users={users} value={responsibleId} onChange={setResponsibleId} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Criar e abrir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MediaListPage() {
  const { can } = useAuth();
  const [scope, setScope] = useState<'mine' | 'all'>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [situation, setSituation] = useState('open');
  const statuses = useResource(() => api.media.statuses(), []);
  const medias = useResource(
    () =>
      api.media.list({
        mine: scope === 'mine' || undefined,
        search: query || undefined,
        mediaTypes: type === 'all' ? undefined : [type as MediaType],
        situations: SITUATIONS[situation],
        limit: 200,
      }),
    [scope, query, type, situation],
  );
  const status = (id: string | null) => statuses.data?.find((item) => item.id === id);

  return (
    <>
      <PageHeader
        title="Mídia"
        description="Pedidos de inserção (PI) com veículos."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/midia/configuracoes">Redes, praças e programas</Link>
            </Button>
            {can('medias') && <NewMediaDialog onCreated={() => void medias.reload()} />}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={scope} onValueChange={(value) => setScope(value as 'mine' | 'all')}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="mine">Minhas</TabsTrigger>
          </TabsList>
        </Tabs>
        <form
          className="relative w-64"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Título ou nº do orçamento"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => setQuery(search.trim())}
          />
        </form>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(MEDIA_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={situation} onValueChange={setSituation}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abertas</SelectItem>
            <SelectItem value="done">Concluídas</SelectItem>
            <SelectItem value="canceled">Canceladas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ErrorMessage error={medias.error} />
      {medias.loading && !medias.data ? (
        <Loading />
      ) : medias.data?.items.length === 0 ? (
        <EmptyState>Nenhuma mídia encontrada.</EmptyState>
      ) : (
        medias.data && (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-20">Tipo</TableHead>
                    <TableHead>Mídia</TableHead>
                    <TableHead>Cliente / projeto</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead className="w-24">Prazo</TableHead>
                    <TableHead className="w-28 text-right">Valor</TableHead>
                    <TableHead className="w-44">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medias.data.items.map((media) => (
                    <TableRow key={media.id} className={media.situation !== 'OPEN' ? 'opacity-60' : ''}>
                      <TableCell>
                        <UserAvatar user={media.responsible} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{MEDIA_TYPE_LABEL[media.mediaType]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/midia/${media.id}`} className="font-medium hover:underline">
                          <span className="mr-1.5 text-muted-foreground tabular-nums">{media.number}</span>
                          {media.title}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {media.client?.name}
                        <span className="text-muted-foreground"> / {media.project?.title}</span>
                      </TableCell>
                      <TableCell className="text-sm">{media.vehicle?.name ?? '—'}</TableCell>
                      <TableCell className={`tabular-nums ${media.overdue ? 'font-medium text-destructive' : ''}`}>
                        {formatDeadline(media.deadline, false)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(media.grossTotal)}</TableCell>
                      <TableCell>
                        <StatusBadge status={status(media.statusId)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Exibindo {medias.data.items.length} de {medias.data.total}
            </p>
          </>
        )
      )}
    </>
  );
}
