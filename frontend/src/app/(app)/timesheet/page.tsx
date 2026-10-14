'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState, ErrorMessage, Loading, PageHeader } from '@/components/common';
import { EntriesTable } from '@/components/timesheet/entries-table';
import { useTimer } from '@/components/timesheet/timer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { formatMinutes, toLocalDateInput } from '@/lib/format';
import { api } from '@/services';

const DAY = 86_400_000;

/** Pauta de apontamentos: os seus ou de todos, num período. */
export default function TimesheetPage() {
  const { can } = useAuth();
  const { version } = useTimer();
  const today = toLocalDateInput(new Date().toISOString());
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [from, setFrom] = useState(() => toLocalDateInput(new Date(Date.now() - 6 * DAY).toISOString()));
  const [to, setTo] = useState(today);
  const [limit, setLimit] = useState(100);

  const entries = useResource(
    () => api.timesheet.list({ mine: scope === 'mine', from: from || undefined, to: to || undefined, limit }),
    [scope, from, to, limit, version],
  );

  return (
    <>
      <PageHeader
        title="Timesheet"
        description="Apontamentos de horas. Inicie o cronômetro ou aponte manualmente na aba Timesheet do job."
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {can('jobs', 2) && (
          <Tabs value={scope} onValueChange={(value) => setScope(value as 'mine' | 'all')}>
            <TabsList>
              <TabsTrigger value="mine">Meus</TabsTrigger>
              <TabsTrigger value="all">Equipe</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="grid gap-1">
          <Label htmlFor="from" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input
            id="from"
            type="date"
            className="w-40"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="to" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input id="to" type="date" className="w-40" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFrom(today);
            setTo(today);
          }}
        >
          Hoje
        </Button>
      </div>

      <ErrorMessage error={entries.error} />
      {entries.loading && !entries.data ? (
        <Loading />
      ) : entries.data?.items.length === 0 ? (
        <EmptyState>Nenhum apontamento no período.</EmptyState>
      ) : (
        entries.data && (
          <>
            <div className="rounded-lg border">
              <EntriesTable entries={entries.data.items} onChange={() => void entries.reload()} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Exibindo {entries.data.items.length} de {entries.data.total} · Total{' '}
                <strong className="text-foreground">{formatMinutes(entries.data.totalMinutes)}</strong>
              </span>
              {entries.data.items.length < entries.data.total && limit < 200 && (
                <Button variant="outline" size="sm" onClick={() => setLimit(200)}>
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
