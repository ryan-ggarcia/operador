'use client';

import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { PartyPicker, StatusSelect, UserSelect } from '@/components/pickers';
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
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { localDateTimeToIso, textToHtml } from '@/lib/format';
import { api } from '@/services';
import type { NamedRef, Project } from '@/services/types';

const GENERAL = '__geral__';
const NO_TEMPLATE = '__none__';

/** Novo job. Sem projeto, o servidor coloca no projeto "Geral" do cliente. */
export function NewJobDialog({
  client: fixedClient,
  project: fixedProject,
  onCreated,
}: {
  client?: NamedRef;
  project?: { id: string; title: string };
  onCreated?: () => void;
}) {
  const router = useRouter();
  const { can } = useAuth();
  const { users, jobStatuses } = useReferenceData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState<NamedRef | null>(fixedClient ?? null);
  const [projectId, setProjectId] = useState<string>(fixedProject?.id ?? GENERAL);
  const [projects, setProjects] = useState<{ clientId: string | null; items: Project[] }>({
    clientId: null,
    items: [],
  });
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [briefing, setBriefing] = useState('');
  const [templateJobId, setTemplateJobId] = useState(NO_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const templateJobs = useResource(() => (open ? api.templates.jobs() : Promise.resolve([])), [open]);
  const templateJob = templateJobs.data?.find((item) => item.id === templateJobId);

  function chooseTemplate(id: string) {
    setTemplateJobId(id);
    const chosen = templateJobs.data?.find((item) => item.id === id);
    if (!chosen) return;
    setResponsibleId(chosen.responsibleId);
    setStatusId(chosen.statusId);
  }

  // Projetos abertos do cliente (só para quem tem acesso a projetos).
  const listProjects = open && !fixedProject && client !== null && can('projects');
  useEffect(() => {
    if (!listProjects || !client) return;
    let active = true;
    api.projects
      .list({ clientId: client.id, situations: ['OPEN'], limit: 100 })
      .then((page) => {
        if (active) setProjects({ clientId: client.id, items: page.items.filter((item) => !item.isClientDefault) });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [listProjects, client]);
  const clientProjects = listProjects && projects.clientId === client?.id ? projects.items : [];

  function reset() {
    setTitle('');
    if (!fixedClient) setClient(null);
    setProjectId(fixedProject?.id ?? GENERAL);
    setResponsibleId(null);
    setStatusId(null);
    setDeadlineDate('');
    setDeadlineTime('');
    setBriefing('');
    setTemplateJobId(NO_TEMPLATE);
  }

  async function save(openAfter: boolean) {
    if (!client) {
      toast.error('Escolha o cliente.');
      return;
    }
    setSaving(true);
    try {
      const deadline = deadlineDate
        ? deadlineTime
          ? localDateTimeToIso(deadlineDate, deadlineTime)
          : deadlineDate
        : null;
      const target = { clientId: client.id, projectId: projectId === GENERAL ? null : projectId };
      const schedule = { deadline, deadlineHasTime: Boolean(deadlineDate && deadlineTime) };
      const job = templateJob
        ? await api.templates.createJob(templateJob.id, {
            ...target,
            ...schedule,
            title: title || null,
            responsibleId,
            statusId,
          })
        : await api.jobs.create({
            title,
            ...target,
            responsibleId,
            statusId,
            ...schedule,
            briefing: briefing.trim() ? textToHtml(briefing) : null,
          });
      toast.success(`Job ${job.number} criado.`);
      reset();
      setOpen(false);
      onCreated?.();
      if (openAfter) router.push(`/jobs/${job.id}`);
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
          <Plus /> Novo job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Novo job</DialogTitle>
          <DialogDescription>
            {fixedProject
              ? `No projeto ${fixedProject.title}.`
              : 'Sem projeto, o job vai para o projeto Geral do cliente.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="job-title">Título</Label>
            <Input
              id="job-title"
              required={!templateJob}
              maxLength={250}
              placeholder={templateJob?.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {Boolean(templateJobs.data?.length) && (
            <div className="grid gap-2">
              <Label>Modelo</Label>
              <Select value={templateJobId} onValueChange={chooseTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Sem modelo</SelectItem>
                  {templateJobs.data?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.templateTitle} › {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateJob && (
                <p className="text-xs text-muted-foreground">
                  Briefing e {templateJob.tasks.length} tarefa(s) vêm do modelo.
                </p>
              )}
            </div>
          )}
          {!fixedClient && (
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <PartyPicker
                role="client"
                value={client}
                onChange={(value) => {
                  setClient(value);
                  setProjectId(GENERAL);
                }}
                placeholder="Escolha o cliente"
              />
            </div>
          )}
          {!fixedProject && can('projects') && (
            <div className="grid gap-2">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!client}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERAL}>Geral (projeto do cliente)</SelectItem>
                  {clientProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.number} · {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
          <div className="grid gap-2">
            <Label htmlFor="job-deadline">Prazo</Label>
            <div className="flex gap-2">
              <Input
                id="job-deadline"
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
              />
              <Input
                type="time"
                aria-label="Hora do prazo (opcional)"
                className="w-32"
                value={deadlineTime}
                disabled={!deadlineDate}
                onChange={(e) => setDeadlineTime(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Sem hora, o prazo vale até o fim do dia.</p>
          </div>
          <div className={templateJob ? 'hidden' : 'grid gap-2'}>
            <Label htmlFor="job-briefing">Briefing</Label>
            <Textarea id="job-briefing" rows={4} value={briefing} onChange={(e) => setBriefing(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)}>
              Salvar e abrir
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
