'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { initials } from '@/lib/format';
import type { JobSituation, ProjectSituation, Status, UserRef } from '@/services/types';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function UserAvatar({ user, size = 'default' }: { user: UserRef | null; size?: 'sm' | 'default' }) {
  if (!user) return <span className="text-muted-foreground">—</span>;
  const classes = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={classes}>
          <AvatarFallback
            style={user.color ? { backgroundColor: user.color, color: 'white' } : undefined}
          >
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{user.name}</TooltipContent>
    </Tooltip>
  );
}

export function UserList({ users }: { users: UserRef[] }) {
  if (users.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex -space-x-1.5">
      {users.map((user) => (
        <UserAvatar key={user.id} user={user} size="sm" />
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: Pick<Status, 'name' | 'color'> | undefined | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">Sem status</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
      {status.name}
    </span>
  );
}

const SITUATION_LABEL: Record<JobSituation | ProjectSituation, string> = {
  OPEN: 'Aberto',
  DONE: 'Concluído',
  ARCHIVED: 'Arquivado',
  CANCELED: 'Cancelado',
};

export function SituationBadge({ situation }: { situation: JobSituation | ProjectSituation }) {
  const variant = situation === 'OPEN' ? 'secondary' : situation === 'CANCELED' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{SITUATION_LABEL[situation]}</Badge>;
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorMessage({ error }: { error: Error | null | undefined }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle />
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** Mostra o HTML já higienizado pelo servidor. */
export function RichText({ html, empty = 'Sem descrição.' }: { html: string | null | undefined; empty?: string }) {
  if (!html) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div
      className="prose-sm max-w-none text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
