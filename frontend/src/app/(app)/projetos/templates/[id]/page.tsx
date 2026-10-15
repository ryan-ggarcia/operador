'use client';

import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorMessage, Loading, PageHeader } from '@/components/common';
import { StatusSelect, UserSelect } from '@/components/pickers';
import { useReferenceData } from '@/components/reference-data';
import { useCanManageTemplates } from '@/components/templates/copy-menus';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { htmlToText, textToHtml } from '@/lib/format';
import { api } from '@/services';
import type { Template, TemplateJob } from '@/services/templates.service';

/** Job do editor: briefing em texto simples (vira HTML ao salvar). */
interface DraftJob extends Omit<TemplateJob, 'briefing'> {
  key: string;
  briefingText: string;
}

let nextKey = 0;
const newKey = () => `j${nextKey++}`;

function toDraft(template: Template | null): { title: string; briefing: string; jobs: DraftJob[] } {
  return {
    title: template?.title ?? '',
    briefing: htmlToText(template?.briefing),
    jobs: (template?.jobs ?? []).map((job) => ({ ...job, key: newKey(), briefingText: htmlToText(job.briefing) })),
  };
}

function TemplateEditor({ template }: { template: Template | null }) {
  const router = useRouter();
  const manager = useCanManageTemplates();
  const { users, jobStatuses } = useReferenceData();
  const [draft, setDraft] = useState(() => toDraft(template));
  const [saving, setSaving] = useState(false);
  const readOnly = !manager;

  const setJob = (key: string, change: Partial<DraftJob>) =>
    setDraft((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (job.key === key ? { ...job, ...change } : job)),
    }));
  const move = (index: number, offset: number) =>
    setDraft((current) => {
      const jobs = [...current.jobs];
      const [job] = jobs.splice(index, 1);
      jobs.splice(index + offset, 0, job!);
      return { ...current, jobs };
    });

  async function save() {
    setSaving(true);
    try {
      const input = {
        title: draft.title,
        briefing: draft.briefing.trim() ? textToHtml(draft.briefing) : null,
        jobs: draft.jobs.map((job) => ({
          title: job.title,
          responsibleId: job.responsibleId,
          statusId: job.statusId,
          briefing: job.briefingText.trim() ? textToHtml(job.briefingText) : null,
          tasks: job.tasks.filter((task) => task.title.trim()),
        })),
      };
      if (template) await api.templates.update(template.id, input);
      else await api.templates.create(input);
      toast.success('Template salvo.');
      router.push('/projetos/templates');
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={template ? template.title : 'Novo template'}
        description="Título, briefing e a lista de jobs com as tarefas de cada um."
        actions={
          !readOnly && (
            <Button disabled={saving || !draft.title.trim()} onClick={() => void save()}>
              {saving && <Loader2 className="animate-spin" />} Salvar template
            </Button>
          )
        }
      />
      <div className="grid max-w-4xl gap-6">
        <Card>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="template-title">Nome</Label>
              <Input
                id="template-title"
                disabled={readOnly}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-briefing">Briefing do projeto</Label>
              <Textarea
                id="template-briefing"
                rows={3}
                disabled={readOnly}
                value={draft.briefing}
                onChange={(e) => setDraft({ ...draft, briefing: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {draft.jobs.map((job, index) => (
          <Card key={job.key}>
            <CardHeader>
              <CardTitle>Job {index + 1}</CardTitle>
              {!readOnly && (
                <CardAction className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Subir"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descer"
                    disabled={index === draft.jobs.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Tirar job"
                    onClick={() =>
                      setDraft({ ...draft, jobs: draft.jobs.filter((current) => current.key !== job.key) })
                    }
                  >
                    <Trash2 />
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2 sm:col-span-3">
                  <Label htmlFor={`job-title-${job.key}`}>Título</Label>
                  <Input
                    id={`job-title-${job.key}`}
                    disabled={readOnly}
                    value={job.title}
                    onChange={(e) => setJob(job.key, { title: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Responsável</Label>
                  <UserSelect
                    users={users}
                    disabled={readOnly}
                    value={job.responsibleId}
                    onChange={(responsibleId) => setJob(job.key, { responsibleId })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <StatusSelect
                    statuses={jobStatuses.filter((status) => status.active || status.id === job.statusId)}
                    disabled={readOnly}
                    value={job.statusId}
                    onChange={(statusId) => setJob(job.key, { statusId })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`job-briefing-${job.key}`}>Briefing do job</Label>
                <Textarea
                  id={`job-briefing-${job.key}`}
                  rows={2}
                  disabled={readOnly}
                  value={job.briefingText}
                  onChange={(e) => setJob(job.key, { briefingText: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Tarefas</Label>
                {job.tasks.map((task, taskIndex) => (
                  <div key={taskIndex} className="flex gap-2">
                    <Input
                      aria-label={`Tarefa ${taskIndex + 1}`}
                      disabled={readOnly}
                      value={task.title}
                      onChange={(e) =>
                        setJob(job.key, {
                          tasks: job.tasks.map((current, i) =>
                            i === taskIndex ? { ...current, title: e.target.value } : current,
                          ),
                        })
                      }
                    />
                    <div className="w-48 shrink-0">
                      <UserSelect
                        users={users}
                        disabled={readOnly}
                        value={task.responsibleId}
                        onChange={(responsibleId) =>
                          setJob(job.key, {
                            tasks: job.tasks.map((current, i) =>
                              i === taskIndex ? { ...current, responsibleId } : current,
                            ),
                          })
                        }
                      />
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Tirar tarefa"
                        onClick={() => setJob(job.key, { tasks: job.tasks.filter((_, i) => i !== taskIndex) })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setJob(job.key, { tasks: [...job.tasks, { title: '', responsibleId: null }] })}
                    >
                      <Plus /> Tarefa
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {!readOnly && (
          <div>
            <Button
              variant="outline"
              onClick={() =>
                setDraft({
                  ...draft,
                  jobs: [
                    ...draft.jobs,
                    { key: newKey(), title: '', responsibleId: null, statusId: null, briefingText: '', tasks: [] },
                  ],
                })
              }
            >
              <Plus /> Adicionar job
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

export default function TemplatePage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'novo';
  const template = useResource(() => (isNew ? Promise.resolve(null) : api.templates.get(id)), [id]);
  if (template.loading && template.data === undefined) return <Loading />;
  if (template.error) return <ErrorMessage error={template.error} />;
  return <TemplateEditor key={id} template={template.data ?? null} />;
}
