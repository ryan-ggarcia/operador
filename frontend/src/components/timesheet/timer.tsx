'use client';

import { Loader2, Play, Square, Timer } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatMinutes } from '@/lib/format';
import { api } from '@/services';
import type { TimeEntry, TimesheetDocType } from '@/services/timesheet.service';

interface TimerState {
  current: TimeEntry | null;
  start: (docType: TimesheetDocType, docId: string) => Promise<void>;
  /** Abre o diálogo de parar (descrição e retrabalho). */
  requestStop: () => void;
  /** Muda a cada parada ou início: as telas recarregam os apontamentos. */
  version: number;
}

const Context = createContext<TimerState | null>(null);

/** Hora atual, atualizada a cada segundo. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function docHref(entry: TimeEntry): string | null {
  if (entry.doc.jobId) return `/jobs/${entry.doc.jobId}`;
  if (entry.doc.docType === 'project') return `/projetos/${entry.doc.id}`;
  return null;
}

/** Cronômetro do usuário: um por vez, estado guardado no servidor. */
export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<TimeEntry | null>(null);
  const [version, setVersion] = useState(0);
  const [stopping, setStopping] = useState(false);
  const [description, setDescription] = useState('');
  const [rework, setRework] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.timesheet
      .current()
      .then((entry) => {
        if (active) setCurrent(entry);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const start = useCallback(async (docType: TimesheetDocType, docId: string) => {
    try {
      setCurrent(await api.timesheet.start(docType, docId));
      setVersion((value) => value + 1);
      toast.success('Cronômetro iniciado.');
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }, []);

  const requestStop = useCallback(() => {
    setDescription(current?.description ?? '');
    setRework(false);
    setStopping(true);
  }, [current]);

  async function stop(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const entry = await api.timesheet.stop({
        description: description.trim() || null,
        kind: rework ? 'REWORK' : 'NORMAL',
      });
      toast.success(`Apontado: ${formatMinutes(entry.minutes)}.`);
      setCurrent(null);
      setStopping(false);
      setVersion((value) => value + 1);
    } catch (caught) {
      toast.error((caught as Error).message);
      // Parado por outra pessoa ou pelo arquivamento do projeto.
      setCurrent(await api.timesheet.current().catch(() => null));
    } finally {
      setSaving(false);
    }
  }

  const value = useMemo(() => ({ current, start, requestStop, version }), [current, start, requestStop, version]);

  return (
    <Context.Provider value={value}>
      {children}
      <Dialog open={stopping} onOpenChange={setStopping}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Parar cronômetro</DialogTitle>
            <DialogDescription>
              {current?.doc.number} {current?.doc.parentTitle ? `${current.doc.parentTitle} › ` : ''}
              {current?.doc.title}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={stop} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="timer-description">O que foi feito</Label>
              <Textarea
                id="timer-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <Label className="flex items-center gap-2 font-normal">
              <Checkbox checked={rework} onCheckedChange={(checked) => setRework(checked === true)} />
              Marcar este tempo como retrabalho
            </Label>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Parar e apontar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}

export function useTimer(): TimerState {
  const context = useContext(Context);
  if (!context) throw new Error('useTimer precisa estar dentro de <TimerProvider>.');
  return context;
}

/** Cronômetro no topo da tela. */
export function TimerWidget() {
  const { current, requestStop } = useTimer();
  const now = useNow(Boolean(current));
  if (!current) {
    return (
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
        <Link href="/timesheet">
          <Timer /> Timesheet
        </Link>
      </Button>
    );
  }
  const href = docHref(current);
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-3 text-sm">
      <span className="size-2 animate-pulse rounded-full bg-red-500" />
      <span className="font-mono tabular-nums">{formatElapsed(now - new Date(current.startedAt).getTime())}</span>
      {href ? (
        <Link href={href} className="hidden max-w-56 truncate hover:underline md:inline">
          {current.doc.number} {current.doc.title}
        </Link>
      ) : (
        <span className="hidden max-w-56 truncate md:inline">{current.doc.title}</span>
      )}
      <Button size="xs" variant="destructive" onClick={requestStop}>
        <Square /> Parar
      </Button>
    </div>
  );
}

/** Botão de iniciar o cronômetro num documento. */
export function StartTimerButton({
  docType,
  docId,
  disabled,
}: {
  docType: TimesheetDocType;
  docId: string;
  disabled?: boolean;
}) {
  const { current, start, requestStop } = useTimer();
  const [busy, setBusy] = useState(false);
  if (current?.doc.id === docId) {
    return (
      <Button variant="outline" onClick={requestStop}>
        <Square className="text-red-500" /> Parar cronômetro
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        await start(docType, docId);
        setBusy(false);
      }}
    >
      <Play /> Iniciar cronômetro
    </Button>
  );
}
