'use client';

import { CheckCircle2, Circle, Loader2, Pencil, Plus, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApprovalAttachments, involvedOf } from '@/components/approvals';
import { Comments } from '@/components/comments';
import {
  ErrorMessage,
  Loading,
  PageHeader,
  RichText,
  SituationBadge,
  StatusBadge,
  UserAvatar,
  UserList,
} from '@/components/common';
import { StatusSelect, UserSelect } from '@/components/pickers';
import { useReferenceData } from '@/components/reference-data';
import { DocumentTimesheet } from '@/components/timesheet/document-timesheet';
import { JobCopyMenu } from '@/components/templates/copy-menus';
import { StartTimerButton } from '@/components/timesheet/timer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import {
  formatDateTime,
  formatDeadline,
  formatMinutes,
  htmlToText,
  localDateTimeToIso,
  textToHtml,
  toLocalDateInput,
  toLocalTimeInput,
} from '@/lib/format';
import { api } from '@/services';
import type { JobAction } from '@/services/projects.service';
import type { JobDetail } from '@/services/types';

const HISTORY_LABEL: Record<string, string> = {
  title: 'Título',
  responsibleId: 'Responsável',
  statusId: 'Status',
  deadline: 'Prazo',
  startAt: 'Início',
  estimatedMinutes: 'Tempo estimado',
  briefing: 'Briefing',
  situation: 'Situação',
  projectId: 'Projeto',
  clientContactId: 'Contato',
  deadlineHasTime: 'Prazo com hora',
};

function EditJob({ job, onSaved, onCancel }: { job: JobDetail; onSaved: () => void; onCancel: () => void }) {
  const { users, jobStatuses } = useReferenceData();
  const [title, setTitle] = useState(job.title);
  const [responsibleId, setResponsibleId] = useState(job.responsible?.id ?? null);
  const [statusId, setStatusId] = useState(job.statusId);
  const [date, setDate] = useState(toLocalDateInput(job.deadline));
  const [time, setTime] = useState(job.deadlineHasTime ? toLocalTimeInput(job.deadline) : '');
  const [estimated, setEstimated] = useState(job.estimatedMinutes ? String(job.estimatedMinutes / 60) : '');
  const [briefing, setBriefing] = useState(htmlToText(job.briefing));
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.jobs.update(job.id, {
        title,
        responsibleId,
        statusId,
        deadline: date ? (time ? localDateTimeToIso(date, time) : date) : null,
        deadlineHasTime: Boolean(date && time),
        estimatedMinutes: estimated ? Math.round(Number(estimated.replace(',', '.')) * 60) : null,
        briefing: briefing.trim() ? textToHtml(briefing) : null,
      });
      toast.success('Job salvo.');
      onSaved();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" required maxLength={250} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Responsável</Label>
          <UserSelect users={users} value={responsibleId} onChange={setResponsibleId} />
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <StatusSelect statuses={jobStatuses} value={statusId} onChange={setStatusId} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Prazo</Label>
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input
              type="time"
              className="w-32"
              value={time}
              disabled={!date}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimated">Tempo estimado (horas)</Label>
          <Input id="estimated" inputMode="decimal" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="briefing">Briefing</Label>
        <Textarea id="briefing" rows={6} value={briefing} onChange={(e) => setBriefing(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Salvar
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Tasks({ job, onChange }: { job: JobDetail; onChange: () => void }) {
  const { users, user } = useReferenceData();
  const [title, setTitle] = useState('');
  const [responsibleId, setResponsibleId] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await api.jobs.createTask(job.id, title, responsibleId);
      setTitle('');
      onChange();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function act(taskId: string, action: JobAction) {
    try {
      await api.jobs.actOnTask(taskId, action);
      onChange();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {job.tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa.</p>}
      <ul className={job.tasks.length ? 'flex flex-col divide-y rounded-lg border' : 'hidden'}>
        {job.tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={task.situation === 'OPEN' ? 'Concluir tarefa' : 'Reabrir tarefa'}
              disabled={job.situation !== 'OPEN'}
              onClick={() => void act(task.id, task.situation === 'OPEN' ? 'complete' : 'reopen')}
            >
              {task.situation === 'DONE' ? (
                <CheckCircle2 className="text-green-600" />
              ) : task.situation === 'CANCELED' ? (
                <XCircle className="text-muted-foreground" />
              ) : (
                <Circle />
              )}
            </Button>
            <span className={`flex-1 ${task.situation !== 'OPEN' ? 'text-muted-foreground line-through' : ''}`}>
              {task.title}
            </span>
            <UserAvatar user={user(task.responsibleId) ?? null} size="sm" />
          </li>
        ))}
      </ul>
      {job.can.edit && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input
            className="min-w-48 flex-1"
            placeholder="Nova tarefa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="w-48">
            <UserSelect users={users} value={responsibleId} onChange={setResponsibleId} placeholder="Sem responsável" />
          </div>
          <Button type="submit" variant="outline" disabled={!title.trim()}>
            <Plus /> Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

function History({ jobId }: { jobId: string }) {
  const { user } = useReferenceData();
  const history = useResource(() => api.jobs.history(jobId), [jobId]);
  if (history.loading) return <Loading />;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {history.data?.length === 0 && <li className="text-muted-foreground">Sem alterações.</li>}
      {history.data?.map((entry) => (
        <li key={entry.id} className="flex gap-2">
          <span className="w-36 shrink-0 text-muted-foreground tabular-nums">{formatDateTime(entry.createdAt)}</span>
          <span>
            <strong className="font-medium">{user(entry.userId)?.name ?? 'Sistema'}</strong> alterou{' '}
            {HISTORY_LABEL[entry.field ?? ''] ?? entry.field ?? entry.action}
            {entry.field === 'situation' && ` para ${entry.newValue}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const { jobStatus } = useReferenceData();
  const job = useResource(() => api.jobs.get(id), [id]);
  const [editing, setEditing] = useState(false);
  const [acting, setActing] = useState(false);

  async function act(action: JobAction) {
    setActing(true);
    try {
      await api.jobs.act(id, action);
      await job.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  if (job.loading && !job.data) return <Loading />;
  if (!job.data) return <ErrorMessage error={job.error} />;
  const data = job.data;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground tabular-nums">{data.number}</span> {data.title}
            <SituationBadge situation={data.situation} />
          </span>
        }
        description={
          <>
            {data.client?.name} ·{' '}
            <Link href={`/projetos/${data.project.id}`} className="hover:underline">
              {data.project.number} {data.project.title}
            </Link>
          </>
        }
        actions={
          <>
            <JobCopyMenu job={data} onChanged={() => void job.reload()} />
            {data.situation === 'OPEN' && data.project.situation === 'OPEN' && (
              <StartTimerButton docType="job" docId={data.id} />
            )}
            {data.can.act && (
              <>
                {data.can.edit && !editing && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> Editar
                  </Button>
                )}
                {data.situation === 'OPEN' ? (
                  <>
                    <Button variant="outline" disabled={acting} onClick={() => void act('cancel')}>
                      Cancelar job
                    </Button>
                    <Button disabled={acting} onClick={() => void act('complete')}>
                      <CheckCircle2 /> Concluir
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" disabled={acting} onClick={() => void act('reopen')}>
                    <RotateCcw /> Reabrir
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{editing ? 'Editar job' : 'Briefing'}</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <EditJob
                  job={data}
                  onCancel={() => setEditing(false)}
                  onSaved={() => {
                    setEditing(false);
                    void job.reload();
                  }}
                />
              ) : (
                <RichText html={data.briefing} empty="Sem briefing." />
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="tasks">
            <TabsList>
              <TabsTrigger value="tasks">Tarefas ({data.totalTasks})</TabsTrigger>
              <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
              <TabsTrigger value="comments">Comentários</TabsTrigger>
              <TabsTrigger value="files">Anexos</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="tasks" className="pt-3">
              <Tasks job={data} onChange={() => void job.reload()} />
            </TabsContent>
            <TabsContent value="timesheet" className="pt-3">
              <DocumentTimesheet docType="job" docId={data.id} tasks={data.tasks} />
            </TabsContent>
            <TabsContent value="comments" className="pt-3">
              <Comments docType="JOB" docId={data.id} />
            </TabsContent>
            <TabsContent value="files" className="pt-3">
              <ApprovalAttachments
                docType="JOB"
                docId={data.id}
                involved={involvedOf([data.responsible, data.requester, ...data.members])}
              />
            </TabsContent>
            <TabsContent value="history" className="pt-3">
              <History jobId={data.id} />
            </TabsContent>
          </Tabs>
        </div>

        <Card className="h-fit">
          <CardContent className="grid gap-4 text-sm">
            <Field label="Status">
              <StatusBadge status={jobStatus(data.statusId)} />
            </Field>
            <Field label="Prazo">
              <span className={data.overdue ? 'font-medium text-destructive' : ''}>
                {formatDeadline(data.deadline, data.deadlineHasTime)}
                {data.overdue && ' (atrasado)'}
              </span>
            </Field>
            <Field label="Tempo estimado">{formatMinutes(data.estimatedMinutes)}</Field>
            <Field label="Responsável">
              <span className="flex items-center gap-2">
                <UserAvatar user={data.responsible} size="sm" /> {data.responsible?.name}
              </span>
            </Field>
            <Field label="Solicitante">{data.requester?.name ?? '—'}</Field>
            <Field label="Envolvidos">
              <UserList users={data.members} />
            </Field>
            <Field label="Contato do cliente">{data.clientContact?.name ?? '—'}</Field>
            <Field label="Criado em">{formatDateTime(data.createdAt)}</Field>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
