'use client';

import {
  Download,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorMessage, Loading } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useResource } from '@/hooks/use-resource';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/services';
import type { FileOwnerType, StoredFile } from '@/services/files.service';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const Icon = mimeType.startsWith('image/')
    ? FileImage
    : mimeType.startsWith('video/')
      ? FileVideo
      : mimeType.startsWith('audio/')
        ? FileAudio
        : mimeType === 'application/pdf' || mimeType.startsWith('text/')
          ? FileText
          : /zip|rar|7z|tar|gzip/.test(mimeType)
            ? FileArchive
            : File;
  return <Icon className="size-5 shrink-0 text-muted-foreground" />;
}

/**
 * Ver abre o link temporário numa aba nova (aberta antes da chamada à API,
 * para o navegador não tratar como pop-up). Baixar navega na própria aba:
 * o link responde como anexo, então a página não sai do lugar.
 */
async function openFile(file: StoredFile, inline: boolean) {
  const tab = inline ? window.open('', '_blank') : null;
  try {
    const { url } = await api.files.url(file.id, inline);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch (caught) {
    tab?.close();
    toast.error((caught as Error).message);
  }
}

function FileRow({ file, onChanged }: { file: StoredFile; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(file.description ?? '');

  async function saveDescription() {
    try {
      await api.files.describe(file.id, description.trim() || null);
      setEditing(false);
      onChanged();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function remove() {
    if (!confirm(`Excluir "${file.name}"? O arquivo não poderá ser recuperado.`)) return;
    try {
      await api.files.remove(file.id);
      toast.success('Anexo excluído.');
      onChanged();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <FileIcon mimeType={file.mimeType} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block max-w-full truncate text-left text-sm font-medium hover:underline"
          title="Abrir"
          onClick={() => void openFile(file, true)}
        >
          {file.name}
        </button>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.sizeBytes)} · {formatDateTime(file.createdAt)}
          {file.uploadedBy && ` · ${file.uploadedBy.name}`}
        </p>
        {editing ? (
          <form
            className="mt-1.5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveDescription();
            }}
          >
            <Input
              autoFocus
              className="h-8"
              maxLength={1000}
              placeholder="Descrição do arquivo"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
            />
            <Button type="submit" size="sm" variant="outline">
              Salvar
            </Button>
          </form>
        ) : (
          file.description && <p className="mt-0.5 text-sm">{file.description}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-0.5">
        <Button variant="ghost" size="icon-sm" title="Baixar" onClick={() => void openFile(file, false)}>
          <Download />
        </Button>
        {file.canChange && (
          <>
            <Button variant="ghost" size="icon-sm" title="Descrição" onClick={() => setEditing((value) => !value)}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" title="Excluir" onClick={() => void remove()}>
              <Trash2 />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/** Anexos de um documento: arrastar e soltar, lista, descrição, download e exclusão. */
export function Attachments({ ownerType, ownerId }: { ownerType: FileOwnerType; ownerId: string }) {
  const files = useResource(() => api.files.list(ownerType, ownerId), [ownerType, ownerId]);
  const usage = useResource(() => api.files.usage(), []);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  async function send(selected: File[]) {
    if (selected.length === 0) return;
    const limit = usage.data?.maxFileBytes;
    const tooBig = limit ? selected.filter((file) => file.size > limit) : [];
    if (tooBig.length > 0) {
      toast.error(
        `${tooBig.map((file) => file.name).join(', ')}: cada arquivo pode ter no máximo ${formatBytes(limit!)}.`,
      );
      return;
    }
    setUploading(selected.length === 1 ? selected[0]!.name : `${selected.length} arquivos`);
    try {
      files.setData(await api.files.upload(ownerType, ownerId, selected));
      toast.success(selected.length === 1 ? 'Arquivo enviado.' : `${selected.length} arquivos enviados.`);
      void usage.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setUploading(null);
      if (input.current) input.current.value = '';
    }
  }

  if (files.loading && !files.data) return <Loading />;
  if (!files.data) return <ErrorMessage error={files.error} />;
  const { items, canChange } = files.data;

  return (
    <div className="flex flex-col gap-3">
      {canChange && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Enviar arquivos"
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40',
            dragging && 'border-primary bg-muted/60',
          )}
          onClick={() => !uploading && input.current?.click()}
          onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!uploading) void send([...event.dataTransfer.files]);
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Enviando {uploading}…
            </>
          ) : (
            <>
              <Upload className="size-5" />
              Arraste arquivos aqui ou clique para escolher
              {usage.data && <span className="text-xs">Até {formatBytes(usage.data.maxFileBytes)} por arquivo</span>}
            </>
          )}
          <input
            ref={input}
            type="file"
            multiple
            hidden
            data-testid="attachments-input"
            onChange={(event) => void send([...(event.target.files ?? [])])}
          />
        </div>
      )}
      {usage.data?.quotaBytes && usage.data.usedBytes > usage.data.quotaBytes * 0.9 && (
        <p className="text-xs text-destructive">
          Espaço de anexos quase no fim: {formatBytes(usage.data.usedBytes)} de {formatBytes(usage.data.quotaBytes)}.
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState>Nenhum anexo.</EmptyState>
      ) : (
        <ul className="divide-y">
          {items.map((file) => (
            <FileRow key={`${file.id}-${file.description}`} file={file} onChanged={() => void files.reload()} />
          ))}
        </ul>
      )}
    </div>
  );
}
