'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useResource } from '@/hooks/use-resource';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { api } from '@/services';
import type { AppNotification } from '@/services/notifications.service';

const POLL_MS = 60_000;

/** Sino do cabeçalho: contador de não lidas (atualiza a cada minuto) e lista. */
export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      api.notifications.unreadCount().then(
        (result) => active && setUnread(result.unread),
        () => {},
      );
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  async function load() {
    try {
      const result = await api.notifications.list({ limit: 30 });
      setItems(result.items);
      setUnread(result.unread);
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function openItem(item: AppNotification) {
    setOpen(false);
    if (!item.read) {
      setUnread((count) => Math.max(0, count - 1));
      void api.notifications.markRead([item.id]).catch(() => {});
    }
    if (item.link) router.push(item.link);
  }

  async function markAll() {
    try {
      await api.notifications.markRead();
      setUnread(0);
      setItems((current) => current?.map((item) => ({ ...item, read: true })) ?? null);
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Avisos (${unread} não lidos)`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-medium text-white tabular-nums">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Avisos</span>
          <Button variant="ghost" size="xs" disabled={unread === 0} onClick={() => void markAll()}>
            <CheckCheck /> Marcar todos como lidos
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items === null ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum aviso por aqui.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted/60',
                      !item.read && 'bg-muted/30',
                    )}
                    onClick={() => void openItem(item)}
                  >
                    <UserAvatar user={item.actor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block', !item.read && 'font-medium')}>{item.title}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                    </span>
                    {!item.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Não lido" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Quais avisos o usuário quer receber no sistema. */
export function NotificationPreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const preferences = useResource(() => (open ? api.notifications.preferences() : Promise.resolve(null)), [open]);
  const groups = [...new Set(preferences.data?.map((preference) => preference.group) ?? [])];

  async function toggle(event: string, inApp: boolean) {
    try {
      preferences.setData(await api.notifications.savePreferences([{ event, inApp }]));
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notificações</DialogTitle>
          <DialogDescription>Escolha os avisos que aparecem no sino.</DialogDescription>
        </DialogHeader>
        {groups.map((group) => (
          <div key={group} className="grid gap-3">
            <h3 className="text-sm font-medium">{group}</h3>
            {preferences.data
              ?.filter((preference) => preference.group === group)
              .map((preference) => (
                <div key={preference.event} className="flex items-center justify-between gap-4">
                  <Label htmlFor={`pref-${preference.event}`} className="font-normal">
                    {preference.label}
                  </Label>
                  <Switch
                    id={`pref-${preference.event}`}
                    checked={preference.inApp}
                    onCheckedChange={(checked) => void toggle(preference.event, checked)}
                  />
                </div>
              ))}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
