'use client';

import { Loader2, Plus, Search, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
  SituationBadge,
  StatusBadge,
  UserAvatar,
} from '@/components/common';
import { PartyPicker } from '@/components/pickers';
import { useReferenceData } from '@/components/reference-data';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { textToHtml } from '@/lib/format';
import { api } from '@/services';
import type { NamedRef, ProjectSituation } from '@/services/types';

const SITUATIONS: Record<string, ProjectSituation[] | undefined> = {
  open: ['OPEN'],
  archived: ['ARCHIVED'],
  canceled: ['CANCELED'],
  all: undefined,
};

const NO_TEMPLATE = '__none__';

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const { permissions } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState<NamedRef | null>(null);
  const [description, setDescription] = useState('');
  const [hidden, setHidden] = useState(false);
  const [templateId, setTemplateId] = useState(NO_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const templates = useResource(() => (open ? api.templates.list() : Promise.resolve([])), [open]);
  const template = templates.data?.find((item) => item.id === templateId);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!client) {
      toast.error('Escolha o cliente.');
      return;
    }
    setSaving(true);
    try {
      const project = template
        ? await api.templates.createProject(template.id, { clientId: client.id, title: title || null, hidden })
        : await api.projects.create({
            title,
            clientId: client.id,
            description: description.trim() ? textToHtml(description) : null,
            hidden,
          });
      toast.success(`Projeto ${project.number} criado.`);
      setOpen(false);
      setTitle('');
      setClient(null);
      setDescription('');
      setHidden(false);
      setTemplateId(NO_TEMPLATE);
      onCreated();
      router.push(`/projetos/${project.id}`);
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
          <Plus /> Novo projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-title">Título</Label>
            <Input
              id="project-title"
              required={!template}
              maxLength={250}
              placeholder={template?.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {Boolean(templates.data?.length) && (
            <div className="grid gap-2">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Sem template</SelectItem>
                  {templates.data?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title} ({item.jobsCount} jobs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {template && (
                <p className="text-xs text-muted-foreground">
                  Título (se ficar vazio), briefing, jobs e tarefas vêm do template.
                </p>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <PartyPicker role="client" value={client} onChange={setClient} placeholder="Escolha o cliente" />
          </div>
          <div className={template ? 'hidden' : 'grid gap-2'}>
            <Label htmlFor="project-description">Descrição (briefing)</Label>
            <Textarea
              id="project-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {permissions?.flags.hiddenProjects && (
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={hidden} onCheckedChange={setHidden} /> Projeto oculto (só os envolvidos veem)
            </Label>
          )}
          <DialogFooter>
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

export default function ProjectsPage() {
  const { can } = useAuth();
  const { projectStatus } = useReferenceData();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [situation, setSituation] = useState('open');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const projects = useResource(
    () =>
      api.projects.list({ search: query || undefined, situations: SITUATIONS[situation], favoritesOnly, limit: 100 }),
    [query, situation, favoritesOnly],
  );

  return (
    <>
      <PageHeader
        title="Projetos"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/projetos/templates">Templates</Link>
            </Button>
            {can('projects') && <NewProjectDialog onCreated={() => void projects.reload()} />}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="relative w-64"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Título ou número"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => setQuery(search.trim())}
          />
        </form>
        <Select value={situation} onValueChange={setSituation}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="archived">Arquivados</SelectItem>
            <SelectItem value="canceled">Cancelados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox checked={favoritesOnly} onCheckedChange={(value) => setFavoritesOnly(value === true)} /> Só
          favoritos
        </Label>
      </div>

      <ErrorMessage error={projects.error} />
      {projects.loading && !projects.data ? (
        <Loading />
      ) : projects.data?.items.length === 0 ? (
        <EmptyState>Nenhum projeto encontrado.</EmptyState>
      ) : (
        projects.data && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="w-28">Jobs abertos</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-28">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.data.items.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <UserAvatar user={project.responsible} size="sm" />
                    </TableCell>
                    <TableCell>
                      <Link href={`/projetos/${project.id}`} className="font-medium hover:underline">
                        <span className="mr-1.5 text-muted-foreground tabular-nums">{project.number}</span>
                        {project.title}
                      </Link>
                      {project.favorite && <Star className="ml-1.5 inline size-3.5 fill-amber-400 text-amber-400" />}
                      {project.hidden && <span className="ml-2 text-xs text-muted-foreground">oculto</span>}
                    </TableCell>
                    <TableCell className="text-sm">{project.client?.name ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">
                      {project.openJobs} / {project.totalJobs}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={projectStatus(project.statusId)} />
                    </TableCell>
                    <TableCell>
                      <SituationBadge situation={project.situation} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
      {projects.data && (
        <p className="mt-3 text-sm text-muted-foreground">
          Exibindo {projects.data.items.length} de {projects.data.total}
        </p>
      )}
    </>
  );
}
