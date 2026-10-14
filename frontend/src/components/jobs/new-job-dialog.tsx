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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { localDateTimeToIso, textToHtml } from '@/lib/format';
import { api } from '@/services';
import type { NamedRef, Project } from '@/services/types';

const GENERAL = '__geral__';

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
  const [projects, setProjects] = useState<{ clientId: string | null; items: Project[] }>({ clientId: null, items: [] });
  const [responsibleId, setResponsibleId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [briefing, setBriefing] = useState('');
  const [saving, setSaving] = useState(false);

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
      const job = await api.jobs.create({
        title,
        clientId: client.id,
        projectId: projectId === GENERAL ? null : projectId,
        responsibleId,
        statusId,
        deadline,
        deadlineHasTime: Boolean(deadlineDate && deadlineTime),
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
            {fixedProject ? `No projeto ${fixedProject.title}.` : 'Sem projeto, o job vai para o projeto Geral do cliente.'}
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
            <Input id="job-title" required maxLength={250} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
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
              <Input id="job-deadline" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
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
          <div className="grid gap-2">
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
