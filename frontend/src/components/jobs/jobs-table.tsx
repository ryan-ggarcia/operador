'use client';

import Link from 'next/link';
import { StatusBadge, UserAvatar } from '@/components/common';
import { useReferenceData } from '@/components/reference-data';
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

/** Linhas da pauta: nº, título, prazo, cliente/projeto, responsável, status. */
export function JobsTable({ jobs, showProject = true }: { jobs: Job[]; showProject?: boolean }) {
  const { jobStatus } = useReferenceData();
  return (
    <Table>
      <TableHeader>
        <TableRow>
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
