'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatMinutes } from '@/lib/format';
import { api } from '@/services';
import type { TimeEntry } from '@/services/timesheet.service';

/** Lista de apontamentos (pauta e aba do documento). */
export function EntriesTable({
  entries,
  showDocument = true,
  onChange,
}: {
  entries: TimeEntry[];
  showDocument?: boolean;
  onChange: () => void;
}) {
  async function remove(entry: TimeEntry) {
    if (!confirm('Excluir este apontamento?')) return;
    try {
      await api.timesheet.remove(entry.id);
      onChange();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function toggleRework(entry: TimeEntry) {
    try {
      await api.timesheet.update(entry.id, { kind: entry.kind === 'REWORK' ? 'NORMAL' : 'REWORK' });
      onChange();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead className="w-24">Data</TableHead>
          {showDocument && <TableHead>Documento</TableHead>}
          <TableHead>Descrição</TableHead>
          <TableHead className="w-24">Tipo</TableHead>
          <TableHead className="w-20 text-right">Tempo</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell>
              <UserAvatar user={entry.user} size="sm" />
            </TableCell>
            <TableCell className="tabular-nums">{formatDate(entry.startedAt)}</TableCell>
            {showDocument && (
              <TableCell className="max-w-xs truncate text-sm">
                {entry.doc.jobId ? (
                  <Link href={`/jobs/${entry.doc.jobId}`} className="hover:underline">
                    <span className="text-muted-foreground tabular-nums">{entry.doc.number}</span>{' '}
                    {entry.doc.parentTitle ? `${entry.doc.parentTitle} › ` : ''}
                    {entry.doc.title}
                  </Link>
                ) : (
                  entry.doc.title
                )}
                {entry.client && <div className="text-xs text-muted-foreground">{entry.client.name}</div>}
              </TableCell>
            )}
            <TableCell className="text-sm">
              {!showDocument && entry.doc.parentTitle && (
                <span className="text-muted-foreground">{entry.doc.title} · </span>
              )}
              {entry.description ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {entry.situation === 'RUNNING' ? (
                  <Badge variant="destructive">Rodando</Badge>
                ) : (
                  <Badge variant="outline">{entry.source === 'TIMER' ? 'Timer' : 'Manual'}</Badge>
                )}
                {entry.kind === 'REWORK' && <Badge variant="secondary">RT</Badge>}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatMinutes(entry.minutes)}</TableCell>
            <TableCell>
              {entry.can.edit && entry.situation === 'DONE' && (
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title={entry.kind === 'REWORK' ? 'Marcar como horas normais' : 'Marcar como retrabalho'}
                    onClick={() => void toggleRework(entry)}
                  >
                    RT
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Excluir apontamento"
                    onClick={() => void remove(entry)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
