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
import type { LineInput, Media, MediaGrid, MediaLine, MediaType, Program, ValueType } from '@/services/media.service';

const NONE = '__none__';
const WEEKDAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Campos de texto de cada tipo de mídia (o que aparece na linha da grade). */
const TEXT_FIELDS: Record<MediaType, { key: keyof LineInput; label: string }[]> = {
  TV: [{ key: 'format', label: 'Formato (duração)' }],
  RADIO: [{ key: 'format', label: 'Formato (duração)' }],
  NEWSPAPER: [
    { key: 'section', label: 'Seção' },
    { key: 'position', label: 'Posição' },
    { key: 'color', label: 'Cor' },
    { key: 'format', label: 'Formato' },
  ],
  MAGAZINE: [
    { key: 'product', label: 'Revista / edição' },
    { key: 'format', label: 'Formato' },
  ],
  OOH: [
    { key: 'product', label: 'Produto (ex.: painel de LED)' },
    { key: 'location', label: 'Local (endereço)' },
  ],
  INTERNET: [
    { key: 'position', label: 'Posição' },
    { key: 'format', label: 'Formato' },
    { key: 'placementType', label: 'Tipo' },
  ],
  OTHER: [
    { key: 'location', label: 'Local' },
    { key: 'format', label: 'Formato (o que será entregue)' },
  ],
};

/** Dias do período da grade (no máximo 62, para caber na tela). */
function periodDays(grid: MediaGrid): string[] {
  if (!grid.periodStart || !grid.periodEnd) return [];
  const days: string[] = [];
  const cursor = new Date(`${grid.periodStart.slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${grid.periodEnd.slice(0, 10)}T12:00:00Z`);
  while (cursor <= end && days.length < 62) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function emptyLine(): LineInput {
  return { insertions: 1, unitValue: 0, discountType: 'PERCENT', discountValue: 0, isBonus: false };
}

export function LineDialog({
  media,
  grid,
  line,
  programs,
  costMetrics,
  open,
  onOpenChange,
  onSave,
}: {
  media: Media;
  grid: MediaGrid;
  line: MediaLine | null;
  programs: Program[];
  costMetrics: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: LineInput) => Promise<void>;
}) {
  const [form, setForm] = useState<LineInput>(() =>
    line
      ? {
          ...line,
          startDate: line.startDate?.slice(0, 10) ?? null,
          endDate: line.endDate?.slice(0, 10) ?? null,
        }
      : emptyLine(),
  );
  const [biweeks, setBiweeks] = useState(line?.biweeks?.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const broadcast = media.mediaType === 'TV' || media.mediaType === 'RADIO';
  const program = programs.find((item) => item.id === form.programId);
  const days = periodDays(grid);
  const set = <K extends keyof LineInput>(key: K, value: LineInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const input: LineInput = { ...form };
      if (media.mediaType === 'OOH') {
        const list = biweeks
          .split(/[,;\s]+/)
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0);
        input.biweeks = list.length ? list : null;
      }
      await onSave(input);
      onOpenChange(false);
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{line ? 'Editar linha' : 'Nova linha'}</DialogTitle>
          <DialogDescription>
            {grid.marketName ?? 'Sem praça'}
            {grid.periodStart && ` · ${grid.periodStart.slice(0, 10)} a ${grid.periodEnd?.slice(0, 10) ?? '…'}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Peça</Label>
              <Select
                value={form.pieceId ?? NONE}
                onValueChange={(value) => set('pieceId', value === NONE ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem peça</SelectItem>
                  {media.pieces.map((piece) => (
                    <SelectItem key={piece.id} value={piece.id}>
                      {piece.letter} — {piece.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {broadcast && (
              <div className="grid gap-2">
                <Label>Programa</Label>
                <Select
                  value={form.programId ?? NONE}
                  onValueChange={(value) => set('programId', value === NONE ? null : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha o programa" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                        {item.startTime && ` (${item.startTime}–${item.endTime ?? ''})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {media.mediaType === 'INTERNET' && (
              <div className="grid gap-2">
                <Label>Custo por</Label>
                <Select
                  value={form.costMetricId ?? NONE}
                  onValueChange={(value) => set('costMetricId', value === NONE ? null : value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {costMetrics.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {TEXT_FIELDS[media.mediaType].map((field) => (
              <div key={field.key} className="grid gap-2">
                <Label htmlFor={`line-${field.key}`}>{field.label}</Label>
                <Input
                  id={`line-${field.key}`}
                  value={(form[field.key] as string | null | undefined) ?? ''}
                  onChange={(event) => set(field.key, event.target.value as never)}
                />
              </div>
            ))}
            {!broadcast && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="line-start">Início</Label>
                  <Input
                    id="line-start"
                    type="date"
                    value={form.startDate ?? ''}
                    onChange={(e) => set('startDate', e.target.value || null)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="line-end">Fim</Label>
                  <Input
                    id="line-end"
                    type="date"
                    value={form.endDate ?? ''}
                    onChange={(e) => set('endDate', e.target.value || null)}
                  />
                </div>
              </>
            )}
          </div>

          {broadcast ? (
            <div className="grid gap-2">
              <Label>Inserções por dia</Label>
              {!program ? (
                <p className="text-sm text-muted-foreground">Escolha o programa para marcar os dias.</p>
              ) : days.length === 0 ? (
                <p className="text-sm text-muted-foreground">Defina o período da grade para marcar os dias.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {days.map((day) => {
                    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
                    const airs = program.airingDays.includes(weekday);
                    return (
                      <label
                        key={day}
                        className={`flex w-11 flex-col items-center gap-0.5 text-[10px] ${airs ? '' : 'opacity-40'}`}
                      >
                        <span>
                          {WEEKDAY[weekday]} {day.slice(8)}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          disabled={!airs}
                          className="h-7 px-1 text-center text-xs"
                          value={form.dailyInsertions?.[day] ?? ''}
                          onChange={(event) =>
                            set('dailyInsertions', {
                              ...(form.dailyInsertions ?? {}),
                              [day]: Math.max(0, Number(event.target.value) || 0),
                            })
                          }
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {media.mediaType === 'OOH' && (
                <div className="grid gap-2">
                  <Label htmlFor="line-biweeks">Bi-semanas (ex.: 3, 4, 5)</Label>
                  <Input id="line-biweeks" value={biweeks} onChange={(e) => setBiweeks(e.target.value)} />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="line-insertions">Quantidade</Label>
                <Input
                  id="line-insertions"
                  type="number"
                  min={0}
                  disabled={media.mediaType === 'OOH' && biweeks.trim() !== ''}
                  value={form.insertions ?? 0}
                  onChange={(e) => set('insertions', Math.max(0, Math.round(Number(e.target.value) || 0)))}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="line-unit">Valor unitário (R$)</Label>
              <Input
                id="line-unit"
                type="number"
                min={0}
                step="0.01"
                value={form.unitValue ?? 0}
                onChange={(e) => set('unitValue', Number(e.target.value) || 0)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="line-discount">Desconto</Label>
              <div className="flex gap-2">
                <Input
                  id="line-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discountValue ?? 0}
                  onChange={(e) => set('discountValue', Number(e.target.value) || 0)}
                />
                <Select
                  value={form.discountType ?? 'PERCENT'}
                  onValueChange={(value) => set('discountType', value as ValueType)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">%</SelectItem>
                    <SelectItem value="AMOUNT">R$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Label className="flex items-center gap-2 self-end pb-2 font-normal">
              <Checkbox checked={form.isBonus ?? false} onCheckedChange={(value) => set('isBonus', value === true)} />
              Bonificação
            </Label>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar linha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
