'use client';

import { CalendarClock, Copy, LayoutTemplate, Loader2, MoreVertical, Repeat, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { PostponeDialog, RecurrenceDialog } from '@/components/jobs/job-schedule';
import { PartyPicker } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useResource } from '@/hooks/use-resource';
import { api } from '@/services';
import type { JobDetail, NamedRef, Project } from '@/services/types';

/** Nível Total em projetos: cria e edita templates. */
export function useCanManageTemplates(): boolean {
  const { can } = useAuth();
  return can('projects', 6);
}

const GENERAL = '__geral__';

function useRunner() {
  const [busy, setBusy] = useState(false);
  async function run<T>(action: () => Promise<T>, success: string): Promise<T | null> {
    setBusy(true);
    try {
      const result = await action();
      toast.success(success);
      return result;
    } catch (caught) {
      toast.error((caught as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

/** Escolher cliente (e, para jobs, o projeto aberto do cliente). */
function DestinationFields({
  client,
  onClient,
  projectId,
  onProject,
}: {
  client: NamedRef | null;
  onClient: (client: NamedRef | null) => void;
  projectId?: string;
  onProject?: (id: string) => void;
}) {
  const projects = useResource(
    () =>
      client && onProject
        ? api.projects.list({ clientId: client.id, situations: ['OPEN'], limit: 100 })
        : Promise.resolve(null),
    [client?.id, Boolean(onProject)],
  );
  return (
    <>
      <div className="grid gap-2">
        <Label>Cliente de destino</Label>
        <PartyPicker role="client" value={client} onChange={onClient} placeholder="Escolha o cliente" />
      </div>
      {onProject && (
        <div className="grid gap-2">
          <Label>Projeto</Label>
          <Select value={projectId} onValueChange={onProject} disabled={!client}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL}>Projeto Geral do cliente</SelectItem>
              {projects.data?.items
                .filter((project) => !project.isClientDefault)
                .map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.number} {project.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
}

function SaveAsTemplateDialog({
  defaultTitle,
  onSave,
  onClose,
}: {
  defaultTitle: string;
  onSave: (title: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const { busy, run } = useRunner();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como template</DialogTitle>
          <DialogDescription>Os jobs e tarefas que não foram cancelados viram o modelo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="template-title">Nome do template</Label>
          <Input id="template-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !title.trim()}
            onClick={() => void run(() => onSave(title), 'Template salvo.').then((done) => done && onClose())}
          >
            {busy && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Menu ⋮ do projeto: duplicar, aplicar template e salvar como template. */
export function ProjectCopyMenu({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const router = useRouter();
  const manager = useCanManageTemplates();
  const [dialog, setDialog] = useState<'duplicate' | 'apply' | 'save' | null>(null);
  const [client, setClient] = useState<NamedRef | null>(project.client);
  const [templateId, setTemplateId] = useState<string>('');
  const templates = useResource(() => (dialog === 'apply' ? api.templates.list() : Promise.resolve([])), [dialog]);
  const { busy, run } = useRunner();
  const canApply = project.can.edit && project.situation === 'OPEN';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('duplicate')}>
            <Copy /> Duplicar projeto
          </DropdownMenuItem>
          {canApply && (
            <DropdownMenuItem onSelect={() => setDialog('apply')}>
              <LayoutTemplate /> Aplicar template
            </DropdownMenuItem>
          )}
          {manager && (
            <DropdownMenuItem onSelect={() => setDialog('save')}>
              <Save /> Salvar como template
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'duplicate' && (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Duplicar projeto</DialogTitle>
              <DialogDescription>
                Copia o projeto, os envolvidos e os jobs (com tarefas) que não foram cancelados. Mídias e produções não
                são copiadas.
              </DialogDescription>
            </DialogHeader>
            <DestinationFields client={client} onClient={setClient} />
            <DialogFooter>
              <Button
                disabled={busy || !client}
                onClick={() =>
                  void run(() => api.templates.duplicateProject(project.id, client!.id), 'Projeto duplicado.').then(
                    (copy) => copy && router.push(`/projetos/${copy.id}`),
                  )
                }
              >
                {busy && <Loader2 className="animate-spin" />} Duplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog === 'apply' && (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Aplicar template</DialogTitle>
              <DialogDescription>Os jobs e tarefas do template são incluídos neste projeto.</DialogDescription>
            </DialogHeader>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o template" />
              </SelectTrigger>
              <SelectContent>
                {templates.data?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.title} ({template.jobsCount} jobs)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                disabled={busy || !templateId}
                onClick={() =>
                  void run(() => api.templates.applyToProject(project.id, templateId), 'Template aplicado.').then(
                    (done) => {
                      if (!done) return;
                      setDialog(null);
                      onChanged();
                    },
                  )
                }
              >
                {busy && <Loader2 className="animate-spin" />} Aplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog === 'save' && (
        <SaveAsTemplateDialog
          defaultTitle={project.title}
          onSave={(title) => api.templates.fromProject(project.id, title)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/** Menu ⋮ do job: duplicar, usar tarefas de template e salvar como template. */
export function JobCopyMenu({ job, onChanged }: { job: JobDetail; onChanged: () => void }) {
  const router = useRouter();
  const manager = useCanManageTemplates();
  const [dialog, setDialog] = useState<'duplicate' | 'apply' | 'save' | 'repeat' | 'postpone' | null>(null);
  const [client, setClient] = useState<NamedRef | null>(job.client);
  const [projectId, setProjectId] = useState<string>(GENERAL);
  const [templateJobId, setTemplateJobId] = useState('');
  const options = useResource(() => (dialog === 'apply' ? api.templates.jobs() : Promise.resolve([])), [dialog]);
  const { busy, run } = useRunner();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('duplicate')}>
            <Copy /> Duplicar job
          </DropdownMenuItem>
          {job.can.edit && (
            <DropdownMenuItem onSelect={() => setDialog('apply')}>
              <LayoutTemplate /> Usar tarefas de template
            </DropdownMenuItem>
          )}
          {job.can.edit && job.deadline && !job.recurrence && (
            <DropdownMenuItem onSelect={() => setDialog('repeat')}>
              <Repeat /> Repetir job
            </DropdownMenuItem>
          )}
          {job.can.edit && (
            <DropdownMenuItem onSelect={() => setDialog('postpone')}>
              <CalendarClock /> Adiar prazos
            </DropdownMenuItem>
          )}
          {manager && (
            <DropdownMenuItem onSelect={() => setDialog('save')}>
              <Save /> Salvar como template
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'repeat' && <RecurrenceDialog jobId={job.id} onClose={() => setDialog(null)} onDone={onChanged} />}
      {dialog === 'postpone' && <PostponeDialog jobIds={[job.id]} onClose={() => setDialog(null)} onDone={onChanged} />}

      {dialog === 'duplicate' && (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Duplicar job</DialogTitle>
              <DialogDescription>Copia o job, os envolvidos e as tarefas que não foram canceladas.</DialogDescription>
            </DialogHeader>
            <DestinationFields
              client={client}
              onClient={(next) => {
                setClient(next);
                setProjectId(GENERAL);
              }}
              projectId={projectId}
              onProject={setProjectId}
            />
            <DialogFooter>
              <Button
                disabled={busy || !client}
                onClick={() =>
                  void run(
                    () =>
                      api.templates.duplicateJob(job.id, {
                        clientId: client!.id,
                        projectId: projectId === GENERAL ? null : projectId,
                      }),
                    'Job duplicado.',
                  ).then((copy) => copy && router.push(`/jobs/${copy.id}`))
                }
              >
                {busy && <Loader2 className="animate-spin" />} Duplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog === 'apply' && (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Usar tarefas de template</DialogTitle>
              <DialogDescription>As tarefas do job de template são acrescentadas a este job.</DialogDescription>
            </DialogHeader>
            <Select value={templateJobId} onValueChange={setTemplateJobId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o job de template" />
              </SelectTrigger>
              <SelectContent>
                {options.data
                  ?.filter((option) => option.tasks.length > 0)
                  .map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.templateTitle} › {option.title} ({option.tasks.length} tarefas)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button
                disabled={busy || !templateJobId}
                onClick={() =>
                  void run(() => api.templates.applyToJob(job.id, templateJobId), 'Tarefas incluídas.').then((done) => {
                    if (!done) return;
                    setDialog(null);
                    onChanged();
                  })
                }
              >
                {busy && <Loader2 className="animate-spin" />} Incluir tarefas
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialog === 'save' && (
        <SaveAsTemplateDialog
          defaultTitle={job.title}
          onSave={(title) => api.templates.fromJob(job.id, title)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
