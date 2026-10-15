'use client';

import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorMessage, Loading, PageHeader } from '@/components/common';
import { useReferenceData } from '@/components/reference-data';
import { useCanManageTemplates } from '@/components/templates/copy-menus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useResource } from '@/hooks/use-resource';
import { api } from '@/services';

export default function TemplatesPage() {
  const manager = useCanManageTemplates();
  const { user } = useReferenceData();
  const [search, setSearch] = useState('');
  const templates = useResource(
    () => api.templates.list({ search: search.trim() || undefined, includeInactive: true }),
    [search],
  );

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      toast.success(success);
      void templates.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Templates de projeto"
        description="Modelos com jobs e tarefas para criar projetos e jobs mais rápido."
        actions={
          manager && (
            <Button asChild>
              <Link href="/projetos/templates/novo">
                <Plus /> Novo template
              </Link>
            </Button>
          )
        }
      />
      <Input
        className="mb-4 w-72"
        placeholder="Buscar pelo nome"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ErrorMessage error={templates.error} />
      {templates.loading && !templates.data ? (
        <Loading />
      ) : templates.data?.length === 0 ? (
        <EmptyState>Nenhum template. {manager && 'Crie um novo ou salve um projeto como template.'}</EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead className="w-20 text-right">Jobs</TableHead>
                <TableHead className="w-20 text-right">Tarefas</TableHead>
                <TableHead>Jobs do modelo</TableHead>
                <TableHead className="w-40">Criado por</TableHead>
                {manager && <TableHead className="w-32">Ativo</TableHead>}
                {manager && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.data?.map((template) => (
                <TableRow key={template.id} className={template.active ? '' : 'opacity-60'}>
                  <TableCell>
                    <Link href={`/projetos/templates/${template.id}`} className="font-medium hover:underline">
                      {template.title}
                    </Link>
                    {!template.active && (
                      <Badge variant="outline" className="ml-2">
                        inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{template.jobsCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{template.tasksCount}</TableCell>
                  <TableCell className="max-w-sm truncate text-sm text-muted-foreground">
                    {template.preview.join(', ')}
                    {template.jobsCount > template.preview.length &&
                      ` +${template.jobsCount - template.preview.length}`}
                  </TableCell>
                  <TableCell className="text-sm">{user(template.createdById)?.name ?? '—'}</TableCell>
                  {manager && (
                    <TableCell>
                      <Switch
                        checked={template.active}
                        aria-label="Ativo"
                        onCheckedChange={(active) =>
                          void run(
                            () => api.templates.setActive(template.id, active),
                            active ? 'Template ativado.' : 'Template desativado.',
                          )
                        }
                      />
                    </TableCell>
                  )}
                  {manager && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Excluir template"
                        onClick={() =>
                          confirm(`Excluir o template "${template.title}"?`) &&
                          void run(() => api.templates.remove(template.id), 'Template excluído.')
                        }
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
