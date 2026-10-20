'use client';

import Link from 'next/link';
import { StatusBadge, UserAvatar } from '@/components/common';
import { useReferenceData } from '@/components/reference-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDeadline, isDueToday } from '@/lib/format';
import type { Job } from '@/services/types';

function Deadline({ job }: { job: Job }) {
  const text = formatDeadline(job.deadline, job.deadlineHasTime);
  const tone =
    job.situation !== 'OPEN'
      ? 'text-muted-foreground'
      : job.overdue
        ? 'font-medium text-destructive'
        : isDueToday(job.deadline)
          ? 'font-medium text-orange-600'
          : '';
  return <span className={tone}>{text}</span>;
}

/**
 * Linhas da pauta: nº, título, prazo, cliente/projeto, responsável, status.
 * Com `onSelect`, mostra checkboxes (só nos jobs que o usuário pode editar).
 */
export function JobsTable({
  jobs,
  showProject = true,
  selected = [],
  onSelect,
}: {
  jobs: Job[];
  showProject?: boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
}) {
  const { jobStatus } = useReferenceData();
  const selectable = jobs.filter((job) => job.can.edit).map((job) => job.id);
  const allChecked = selectable.length > 0 && selectable.every((id) => selected.includes(id));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {onSelect && (
            <TableHead className="w-8">
              <Checkbox
                aria-label="Selecionar todos os jobs da página"
                disabled={selectable.length === 0}
                checked={allChecked ? true : selected.length > 0 ? 'indeterminate' : false}
                onCheckedChange={() => onSelect(allChecked ? [] : selectable)}
              />
            </TableHead>
          )}
          <TableHead className="w-10" />
          <TableHead>Job</TableHead>
          <TableHead className="w-28">Prazo</TableHead>
          {showProject && <TableHead>Cliente / projeto</TableHead>}
          <TableHead className="w-44">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id} className={job.situation !== 'OPEN' ? 'opacity-60' : ''}>
            {onSelect && (
              <TableCell>
                <Checkbox
                  aria-label={`Selecionar job ${job.number}`}
                  disabled={!job.can.edit}
                  checked={selected.includes(job.id)}
                  onCheckedChange={(checked) =>
                    onSelect(checked === true ? [...selected, job.id] : selected.filter((id) => id !== job.id))
                  }
                />
              </TableCell>
            )}
            <TableCell>
              <UserAvatar user={job.responsible} size="sm" />
            </TableCell>
            <TableCell className="max-w-md">
              <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                <span className="mr-1.5 text-muted-foreground tabular-nums">{job.number}</span>
                {job.title}
              </Link>
              {job.totalTasks > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {job.openTasks}/{job.totalTasks} tarefas
                </span>
              )}
            </TableCell>
            <TableCell className="tabular-nums">
              <Deadline job={job} />
            </TableCell>
            {showProject && (
              <TableCell className="max-w-xs truncate text-sm">
                {job.client?.name ?? '—'}
                <span className="text-muted-foreground"> / {job.project.title}</span>
              </TableCell>
            )}
            <TableCell>
              <StatusBadge status={jobStatus(job.statusId)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
