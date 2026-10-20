'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services';
import type { PostponeInput, RecurrenceRule } from '@/services/projects.service';
import type { Task } from '@/services/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Repetir o job a partir do prazo dele (diária, semanal ou mensal; até 50 jobs). */
export function RecurrenceDialog({
  jobId,
  onClose,
  onDone,
}: {
  jobId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [frequency, setFrequency] = useState<RecurrenceRule['frequency']>('WEEKLY');
  const [interval, setInterval] = useState('1');
  const [businessDaysOnly, setBusinessDaysOnly] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthlyMode, setMonthlyMode] = useState<'SAME_DAY' | 'LAST_DAY'>('SAME_DAY');
  const [endMode, setEndMode] = useState<'count' | 'until'>('count');
  const [count, setCount] = useState('4');
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const rule: RecurrenceRule = {
        frequency,
        interval: Number(interval),
        ...(frequency === 'DAILY' && { businessDaysOnly }),
        ...(frequency === 'WEEKLY' && { weekdays }),
        ...(frequency === 'MONTHLY' && { monthlyMode }),
        ...(endMode === 'count' ? { count: Number(count) } : { until }),
      };
      const result = await api.jobs.createRecurrence(jobId, rule);
      toast.success(`Recorrência criada: ${result.total} jobs.`);
      onDone();
      onClose();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Repetir job</DialogTitle>
          <DialogDescription>
            Cria cópias do job (com as tarefas) no mesmo projeto, a partir do prazo dele. No máximo 50 jobs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Repetir</Label>
              <Select value={frequency} onValueChange={(value) => setFrequency(value as RecurrenceRule['frequency'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Diariamente</SelectItem>
                  <SelectItem value="WEEKLY">Semanalmente</SelectItem>
                  <SelectItem value="MONTHLY">Mensalmente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurrence-interval">A cada</Label>
              <Input
                id="recurrence-interval"
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              />
            </div>
          </div>
          {frequency === 'DAILY' && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={businessDaysOnly}
                onCheckedChange={(checked) => setBusinessDaysOnly(checked === true)}
              />
              Só dias úteis
            </label>
          )}
          {frequency === 'WEEKLY' && (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((label, day) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={weekdays.includes(day) ? 'default' : 'outline'}
                  aria-pressed={weekdays.includes(day)}
                  onClick={() =>
                    setWeekdays((current) =>
                      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
                    )
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          {frequency === 'MONTHLY' && (
            <Select value={monthlyMode} onValueChange={(value) => setMonthlyMode(value as 'SAME_DAY' | 'LAST_DAY')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAME_DAY">No mesmo dia do mês</SelectItem>
                <SelectItem value="LAST_DAY">No último dia do mês</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Termina</Label>
              <Select value={endMode} onValueChange={(value) => setEndMode(value as 'count' | 'until')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Após N vezes</SelectItem>
                  <SelectItem value="until">Numa data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recurrence-end">{endMode === 'count' ? 'Vezes (com este)' : 'Data final'}</Label>
              {endMode === 'count' ? (
                <Input
                  id="recurrence-end"
                  type="number"
                  min={2}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              ) : (
                <Input id="recurrence-end" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={busy || (endMode === 'until' && !until)} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Criar recorrência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Adiar o prazo do job, das tarefas abertas ou dos dois. */
export function PostponeDialog({
  jobIds,
  onClose,
  onDone,
}: {
  jobIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<PostponeInput['unit']>('DAYS');
  const [target, setTarget] = useState<PostponeInput['target']>('BOTH');
  const [businessDaysOnly, setBusinessDaysOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const result = await api.jobs.postpone({ jobIds, amount: Number(amount), unit, target, businessDaysOnly });
      toast.success(
        `Adiados: ${result.jobs} job(s) e ${result.tasks} tarefa(s).` +
          (result.skipped ? ` ${result.skipped} sem prazo ficaram como estavam.` : ''),
      );
      onDone();
      onClose();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adiar prazos</DialogTitle>
          <DialogDescription>Itens sem prazo são ignorados.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="postpone-amount">Adiar</Label>
              <Input
                id="postpone-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Em</Label>
              <Select value={unit} onValueChange={(value) => setUnit(value as PostponeInput['unit'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINUTES">minutos</SelectItem>
                  <SelectItem value="HOURS">horas</SelectItem>
                  <SelectItem value="DAYS">dias</SelectItem>
                  <SelectItem value="WEEKS">semanas</SelectItem>
                  <SelectItem value="MONTHS">meses</SelectItem>
                  <SelectItem value="YEARS">anos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Select value={target} onValueChange={(value) => setTarget(value as PostponeInput['target'])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BOTH">Job e tarefas</SelectItem>
              <SelectItem value="JOB">Só o job</SelectItem>
              <SelectItem value="TASKS">Só as tarefas</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={businessDaysOnly} onCheckedChange={(checked) => setBusinessDaysOnly(checked === true)} />
            Somente dias úteis
          </label>
        </div>
        <DialogFooter>
          <Button disabled={busy || !(Number(amount) >= 1)} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Adiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Escolhe de quais outras tarefas do job esta depende. */
export function TaskDependenciesDialog({
  task,
  tasks,
  onClose,
  onDone,
}: {
  task: Task;
  tasks: Task[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => task.dependsOnIds);
  const [busy, setBusy] = useState(false);
  const others = tasks.filter((other) => other.id !== task.id);

  async function save() {
    setBusy(true);
    try {
      await api.jobs.setTaskDependencies(task.id, selected);
      toast.success('Dependências salvas.');
      onDone();
      onClose();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Depende de</DialogTitle>
          <DialogDescription>
            &ldquo;{task.title}&rdquo; só pode ser concluída depois das tarefas marcadas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {others.map((other) => (
            <label key={other.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(other.id)}
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked === true ? [...current, other.id] : current.filter((id) => id !== other.id),
                  )
                }
              />
              <span className={other.situation !== 'OPEN' ? 'text-muted-foreground line-through' : ''}>
                {other.title}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
