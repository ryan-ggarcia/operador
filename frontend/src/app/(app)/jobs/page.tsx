'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';
import { PendingApprovals } from '@/components/approvals';
import { EmptyState, ErrorMessage, Loading, PageHeader } from '@/components/common';
import { JobsTable } from '@/components/jobs/jobs-table';
import { NewJobDialog } from '@/components/jobs/new-job-dialog';
import { StatusSelect } from '@/components/pickers';
import { useReferenceData } from '@/components/reference-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { api } from '@/services';
import type { JobSituation } from '@/services/types';

const PAGE = 50;
/** Limite da API por requisição. */
const MAX = 200;

const SITUATIONS: Record<string, JobSituation[] | undefined> = {
  open: ['OPEN'],
  done: ['DONE'],
  canceled: ['CANCELED'],
  all: undefined,
};

export default function JobsPage() {
  const { jobStatuses } = useReferenceData();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [situation, setSituation] = useState('open');
  const [overdue, setOverdue] = useState(false);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const jobs = useResource(
    () =>
      api.jobs.list({
        mine: scope === 'mine',
        search: query || undefined,
        situations: SITUATIONS[situation],
        overdue: overdue || undefined,
        statusIds: statusId ? [statusId] : undefined,
        limit,
      }),
    [scope, query, situation, overdue, statusId, limit],
  );

  return (
    <>
      <PageHeader
        title="Jobs"
        description={scope === 'mine' ? 'Os jobs em que você está envolvido.' : 'Todos os jobs que você pode ver.'}
        actions={<NewJobDialog onCreated={() => void jobs.reload()} />}
      />

      <PendingApprovals />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs value={scope} onValueChange={(value) => setScope(value as 'mine' | 'all')}>
          <TabsList>
            <TabsTrigger value="mine">Minha pauta</TabsTrigger>
            <TabsTrigger value="all">Pauta geral</TabsTrigger>
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
            placeholder="Título ou número (ex.: 1299.4)"
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
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="done">Concluídos</SelectItem>
            <SelectItem value="canceled">Cancelados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <div className="w-48">
          <StatusSelect statuses={jobStatuses} value={statusId} onChange={setStatusId} emptyLabel="Todos os status" />
        </div>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Switch checked={overdue} onCheckedChange={setOverdue} /> Só atrasados
        </Label>
      </div>

      <ErrorMessage error={jobs.error} />
      {jobs.loading && !jobs.data ? (
        <Loading />
      ) : jobs.data && jobs.data.items.length === 0 ? (
        <EmptyState>Nenhum job encontrado.</EmptyState>
      ) : (
        jobs.data && (
          <>
            <div className="rounded-lg border">
              <JobsTable jobs={jobs.data.items} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Exibindo {jobs.data.items.length} de {jobs.data.total}
              </span>
              {jobs.data.items.length < jobs.data.total && limit < MAX && (
                <Button variant="outline" size="sm" onClick={() => setLimit((value) => Math.min(value + PAGE, MAX))}>
                  Carregar mais
                </Button>
              )}
            </div>
          </>
        )
      )}
    </>
  );
}
