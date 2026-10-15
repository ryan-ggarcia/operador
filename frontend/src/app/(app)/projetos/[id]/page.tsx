'use client';

import { Archive, Loader2, Lock, Pencil, RotateCcw, Star, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApprovalAttachments, involvedOf } from '@/components/approvals';
import { Comments } from '@/components/comments';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
  RichText,
  SituationBadge,
  StatusBadge,
  UserAvatar,
  UserList,
} from '@/components/common';
import { JobsTable } from '@/components/jobs/jobs-table';
import { ProjectCopyMenu } from '@/components/templates/copy-menus';
import { NewJobDialog } from '@/components/jobs/new-job-dialog';
import { StatusSelect, UserSelect } from '@/components/pickers';
import { useReferenceData } from '@/components/reference-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { formatDate, formatMoney, htmlToText, textToHtml } from '@/lib/format';
import { api } from '@/services';
import type { Project } from '@/services/types';

function EditProject({ project, onSaved, onCancel }: { project: Project; onSaved: () => void; onCancel: () => void }) {
  const { users, projectStatuses } = useReferenceData();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(htmlToText(project.description));
  const [statusId, setStatusId] = useState(project.statusId);
  const [responsibleId, setResponsibleId] = useState(project.responsible?.id ?? null);
  const [budget, setBudget] = useState(project.budget == null ? '' : String(project.budget));
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.projects.update(project.id, {
        title: project.locked ? undefined : title,
        description: description.trim() ? textToHtml(description) : null,
        statusId,
        responsibleId:
          project.can.editSpecialFields && responsibleId !== project.responsible?.id ? responsibleId : undefined,
        budget: project.can.editBudget && budget !== '' ? Number(budget.replace(',', '.')) : undefined,
      });
      toast.success('Projeto salvo.');
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
        <Input id="title" required disabled={project.locked} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Status</Label>
          <StatusSelect statuses={projectStatuses} value={statusId} onChange={setStatusId} />
        </div>
        <div className="grid gap-2">
          <Label>Responsável</Label>
          <UserSelect
            users={users}
            value={responsibleId}
            onChange={setResponsibleId}
            allowEmpty={false}
            disabled={!project.can.editSpecialFields}
          />
        </div>
        {project.can.editBudget && (
          <div className="grid gap-2">
            <Label htmlFor="budget">Budget (R$)</Label>
            <Input id="budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
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

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { projectStatus } = useReferenceData();
  const project = useResource(() => api.projects.get(id), [id]);
  const jobs = useResource(() => api.jobs.list({ projectId: id, limit: 200, orderBy: 'number' }), [id]);
  const [editing, setEditing] = useState(false);
  const [acting, setActing] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setActing(true);
    try {
      await action();
      toast.success(success);
      await Promise.all([project.reload(), jobs.reload()]);
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  if (project.loading && !project.data) return <Loading />;
  if (!project.data) return <ErrorMessage error={project.error} />;
  const data = project.data;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground tabular-nums">{data.number}</span> {data.title}
            <SituationBadge situation={data.situation} />
            {data.hidden && <span className="text-sm font-normal text-muted-foreground">(oculto)</span>}
          </span>
        }
        description={data.client?.name}
        actions={
          <>
            <ProjectCopyMenu project={data} onChanged={() => void Promise.all([project.reload(), jobs.reload()])} />
            <Button
              variant="ghost"
              size="icon"
              aria-label={data.favorite ? 'Tirar dos favoritos' : 'Favoritar'}
              disabled={data.situation !== 'OPEN' && !data.favorite}
              onClick={() =>
                void run(
                  () => api.projects.setFavorite(id, !data.favorite),
                  data.favorite ? 'Tirado dos favoritos.' : 'Favoritado.',
                )
              }
            >
              <Star className={data.favorite ? 'fill-amber-400 text-amber-400' : ''} />
            </Button>
            {data.can.unlock && (
              <Button
                variant="outline"
                disabled={acting}
                onClick={() => void run(() => api.projects.unlock(id), 'Projeto desbloqueado.')}
              >
                <Lock /> Desbloquear
              </Button>
            )}
            {data.can.edit && !editing && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Editar
              </Button>
            )}
            {data.can.changeSituation && data.situation === 'OPEN' && (
              <>
                <Button
                  variant="outline"
                  disabled={acting}
                  onClick={() => {
                    if (confirm('Cancelar o projeto cancela também todos os jobs dele. Continuar?')) {
                      void run(() => api.projects.cancel(id), 'Projeto cancelado.');
                    }
                  }}
                >
                  <XCircle /> Cancelar
                </Button>
                <Button
                  disabled={acting}
                  onClick={() => {
                    if (confirm('Arquivar conclui o projeto e todos os jobs abertos. Continuar?')) {
                      void run(() => api.projects.archive(id), 'Projeto arquivado.');
                    }
                  }}
                >
                  <Archive /> Arquivar
                </Button>
              </>
            )}
            {data.can.changeSituation && data.situation !== 'OPEN' && (
              <Button
                variant="outline"
                disabled={acting}
                onClick={() => {
                  const reopenDocuments = confirm(
                    'Reabrir também os jobs do projeto? (OK = sim, Cancelar = só o projeto)',
                  );
                  void run(() => api.projects.reopen(id, reopenDocuments), 'Projeto reaberto.');
                }}
              >
                <RotateCcw /> Reabrir
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle>Editar projeto</CardTitle>
              </CardHeader>
              <CardContent>
                <EditProject
                  project={data}
                  onCancel={() => setEditing(false)}
                  onSaved={() => {
                    setEditing(false);
                    void project.reload();
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            data.description && (
              <Card>
                <CardContent>
                  <RichText html={data.description} />
                </CardContent>
              </Card>
            )
          )}

          <Tabs defaultValue="jobs">
            <div className="flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="jobs">Jobs ({jobs.data?.total ?? 0})</TabsTrigger>
                <TabsTrigger value="comments">Comentários</TabsTrigger>
                <TabsTrigger value="files">Anexos</TabsTrigger>
              </TabsList>
              {data.situation === 'OPEN' && data.client && (
                <NewJobDialog
                  client={data.client}
                  project={{ id: data.id, title: data.title }}
                  onCreated={() => void Promise.all([jobs.reload(), project.reload()])}
                />
              )}
            </div>
            <TabsContent value="jobs" className="pt-3">
              {jobs.loading && !jobs.data ? (
                <Loading />
              ) : jobs.data?.items.length ? (
                <div className="rounded-lg border">
                  <JobsTable jobs={jobs.data.items} showProject={false} />
                </div>
              ) : (
                <EmptyState>Nenhum job neste projeto.</EmptyState>
              )}
            </TabsContent>
            <TabsContent value="comments" className="pt-3">
              <Comments docType="PROJECT" docId={data.id} />
            </TabsContent>
            <TabsContent value="files" className="pt-3">
              <ApprovalAttachments
                docType="PROJECT"
                docId={data.id}
                involved={involvedOf([data.responsible, data.requester, ...data.members])}
              />
            </TabsContent>
          </Tabs>
        </div>

        <Card className="h-fit">
          <CardContent className="grid gap-4 text-sm">
            {data.locked && (
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                Projeto Geral do cliente, criado pelo sistema. Fica bloqueado até alguém com permissão total
                desbloquear.
              </p>
            )}
            <Field label="Status">
              <StatusBadge status={projectStatus(data.statusId)} />
            </Field>
            <Field label="Responsável">
              <span className="flex items-center gap-2">
                <UserAvatar user={data.responsible} size="sm" /> {data.responsible?.name}
              </span>
            </Field>
            <Field label="Solicitante">{data.requester?.name ?? '—'}</Field>
            <Field label="Envolvidos">
              <UserList users={data.members} />
            </Field>
            {data.budget != null && <Field label="Budget">{formatMoney(data.budget)}</Field>}
            <Field label="Criado em">{formatDate(data.createdAt)}</Field>
            {data.closedAt && <Field label="Fechado em">{formatDate(data.closedAt)}</Field>}
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
