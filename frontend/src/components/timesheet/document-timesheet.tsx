'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorMessage, Loading } from '@/components/common';
import { EntriesTable } from '@/components/timesheet/entries-table';
import { useTimer } from '@/components/timesheet/timer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useResource } from '@/hooks/use-resource';
import { formatMinutes, parseDuration, toLocalDateInput } from '@/lib/format';
import { api } from '@/services';
import type { TimesheetDocType } from '@/services/timesheet.service';
import type { Task } from '@/services/types';

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

/** Aba Timesheet de um job: estimado × realizado, apontamento manual e lista. */
export function DocumentTimesheet({
  docType,
  docId,
  tasks = [],
}: {
  docType: TimesheetDocType;
  docId: string;
  tasks?: Task[];
}) {
  const { version } = useTimer();
  const summary = useResource(() => api.timesheet.summary(docType, docId), [docType, docId, version]);
  const [date, setDate] = useState(() => toLocalDateInput(new Date().toISOString()));
  const [duration, setDuration] = useState('');
  const [target, setTarget] = useState('doc');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const minutes = parseDuration(duration);
    if (!minutes) {
      toast.error('Informe o tempo, por exemplo 1:30 ou 45.');
      return;
    }
    setSaving(true);
    try {
      await api.timesheet.createManual({
        docType: target === 'doc' ? docType : 'task',
        docId: target === 'doc' ? docId : target,
        date,
        minutes,
        description: description.trim() || null,
      });
      setDuration('');
      setDescription('');
      await summary.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (summary.loading && !summary.data) return <Loading />;
  if (!summary.data) return <ErrorMessage error={summary.error} />;
  const data = summary.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Estimado" value={formatMinutes(data.estimatedMinutes)} />
        <Metric label="Realizado" value={formatMinutes(data.realizedMinutes)} />
        <Metric
          label="Saldo"
          value={
            data.balanceMinutes == null
              ? '—'
              : `${data.balanceMinutes < 0 ? '−' : ''}${formatMinutes(Math.abs(data.balanceMinutes))}`
          }
          tone={data.balanceMinutes != null && data.balanceMinutes < 0 ? 'text-destructive' : ''}
        />
      </div>

      <form onSubmit={add} className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          className="w-40"
          max={toLocalDateInput(new Date().toISOString())}
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Input
          className="w-24"
          placeholder="1:30"
          aria-label="Tempo"
          required
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
        />
        {tasks.length > 0 && (
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="doc">No job</SelectItem>
              {tasks
                .filter((task) => task.situation !== 'CANCELED')
                .map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    Tarefa: {task.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        <Input
          className="min-w-48 flex-1"
          placeholder="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={saving}>
          <Plus /> Apontar
        </Button>
      </form>

      {data.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum apontamento.</p>
      ) : (
        <div className="rounded-lg border">
          <EntriesTable entries={data.entries} showDocument={false} onChange={() => void summary.reload()} />
        </div>
      )}
    </div>
  );
}
