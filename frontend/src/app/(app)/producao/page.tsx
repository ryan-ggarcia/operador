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
import type { ProductionSituation } from '@/services/production.service';
import type { NamedRef } from '@/services/types';

const SITUATIONS: Record<string, ProductionSituation[] | undefined> = {
  open: ['OPEN'],
  done: ['DONE'],
  canceled: ['CANCELED'],
  all: undefined,
};

function NewProductionDialog({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const { users } = useReferenceData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState<NamedRef | null>(null);
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
      const production = await api.production.create({
        title,
        clientId: client.id,
        responsibleId,
        deadline: deadline || null,
      });
      toast.success(`Produção ${production.number} criada.`);
      setOpen(false);
      onCreated();
      router.push(`/producao/${production.id}`);
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
          <Plus /> Nova produção
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Nova produção</DialogTitle>
          <DialogDescription>Sem projeto, a produção vai para o projeto Geral do cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="production-title">Título</Label>
            <Input
              id="production-title"
              required
              maxLength={250}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <PartyPicker role="client" value={client} onChange={setClient} placeholder="Escolha o cliente" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Responsável</Label>
              <UserSelect users={users} value={responsibleId} onChange={setResponsibleId} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="production-deadline">Prazo</Label>
              <Input
                id="production-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
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

export default function ProductionListPage() {
  const { can } = useAuth();
  const [scope, setScope] = useState<'mine' | 'all'>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [situation, setSituation] = useState('open');
  const statuses = useResource(() => api.production.statuses(), []);
  const productions = useResource(
    () =>
      api.production.list({
        mine: scope === 'mine' || undefined,
        search: query || undefined,
        situations: SITUATIONS[situation],
        limit: 200,
      }),
    [scope, query, situation],
  );
  const status = (id: string | null) => statuses.data?.find((item) => item.id === id);

  return (
    <>
      <PageHeader
        title="Produção"
        description="Cotações com fornecedores e pedidos de produção (PP)."
        actions={can('productions') && <NewProductionDialog onCreated={() => void productions.reload()} />}
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

      <ErrorMessage error={productions.error} />
      {productions.loading && !productions.data ? (
        <Loading />
      ) : productions.data?.items.length === 0 ? (
        <EmptyState>Nenhuma produção encontrada.</EmptyState>
      ) : (
        productions.data && (
          <>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Produção</TableHead>
                    <TableHead>Cliente / projeto</TableHead>
                    <TableHead className="w-24">Prazo</TableHead>
                    <TableHead className="w-28 text-right">Valor</TableHead>
                    <TableHead className="w-44">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productions.data.items.map((production) => (
                    <TableRow key={production.id} className={production.situation !== 'OPEN' ? 'opacity-60' : ''}>
                      <TableCell>
                        <UserAvatar user={production.responsible} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Link href={`/producao/${production.id}`} className="font-medium hover:underline">
                          <span className="mr-1.5 text-muted-foreground tabular-nums">{production.number}</span>
                          {production.title}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {production.client?.name}
                        <span className="text-muted-foreground"> / {production.project?.title}</span>
                      </TableCell>
                      <TableCell className={`tabular-nums ${production.overdue ? 'font-medium text-destructive' : ''}`}>
                        {formatDeadline(production.deadline, false)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(production.totalValue)}</TableCell>
                      <TableCell>
                        <StatusBadge status={status(production.statusId)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Exibindo {productions.data.items.length} de {productions.data.total}
            </p>
          </>
        )
      )}
    </>
  );
}
