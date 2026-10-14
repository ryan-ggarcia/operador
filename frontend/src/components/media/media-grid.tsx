'use client';

import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LineDialog } from '@/components/media/line-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/format';
import { api } from '@/services';
import type { LineInput, Market, Media, MediaGrid as Grid, MediaLine, Program } from '@/services/media.service';

const NONE = '__none__';

function describe(line: MediaLine, programs: Program[], costMetrics: { id: string; name: string }[]): string {
  const program = programs.find((item) => item.id === line.programId)?.name;
  const metric = costMetrics.find((item) => item.id === line.costMetricId)?.name;
  return [
    program,
    line.product,
    line.location,
    line.section,
    line.position,
    line.color,
    line.format,
    line.placementType,
    metric && `custo por ${metric}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Uma grade (praça + período) com as linhas. */
export function MediaGridCard({
  media,
  grid,
  markets,
  programs,
  costMetrics,
  onChange,
}: {
  media: Media;
  grid: Grid;
  markets: Market[];
  programs: Program[];
  costMetrics: { id: string; name: string }[];
  onChange: (media: Media) => void;
}) {
  const [dialog, setDialog] = useState<{ line: MediaLine | null } | null>(null);
  const editable = media.can.edit;

  async function run(action: () => Promise<Media>) {
    try {
      onChange(await action());
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function saveLine(input: LineInput) {
    // O erro sobe para o diálogo mostrar e continuar aberto.
    onChange(
      dialog?.line
        ? await api.media.updateLine(media.id, dialog.line.id, input)
        : await api.media.addLine(media.id, grid.id, input),
    );
  }

  const pieceLetter = (id: string | null) => media.pieces.find((piece) => piece.id === id)?.letter ?? '—';

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center gap-2">
        <CardTitle className="mr-2">Grade</CardTitle>
        <Select
          value={grid.marketId ?? NONE}
          disabled={!editable}
          onValueChange={(value) =>
            void run(() => api.media.updateGrid(media.id, grid.id, { marketId: value === NONE ? null : value }))
          }
        >
          <SelectTrigger className="w-48" size="sm">
            <SelectValue placeholder="Praça" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem praça</SelectItem>
            {markets.map((market) => (
              <SelectItem key={market.id} value={market.id}>
                {market.name}
                {market.state && `/${market.state}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-7 w-36"
          disabled={!editable}
          defaultValue={grid.periodStart?.slice(0, 10) ?? ''}
          onBlur={(event) =>
            event.target.value !== (grid.periodStart?.slice(0, 10) ?? '') &&
            void run(() => api.media.updateGrid(media.id, grid.id, { periodStart: event.target.value || null }))
          }
        />
        <span className="text-sm text-muted-foreground">a</span>
        <Input
          type="date"
          className="h-7 w-36"
          disabled={!editable}
          defaultValue={grid.periodEnd?.slice(0, 10) ?? ''}
          onBlur={(event) =>
            event.target.value !== (grid.periodEnd?.slice(0, 10) ?? '') &&
            void run(() => api.media.updateGrid(media.id, grid.id, { periodEnd: event.target.value || null }))
          }
        />
        {editable && (
          <CardAction className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Duplicar grade"
              onClick={() => void run(() => api.media.duplicateGrid(media.id, grid.id, {}))}
            >
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Excluir grade"
              onClick={() =>
                confirm('Excluir a grade e as linhas dela?') && void run(() => api.media.removeGrid(media.id, grid.id))
              }
            >
              <Trash2 />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {grid.lines.length > 0 && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Peça</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-44">Período</TableHead>
                  <TableHead className="w-16 text-right">Qtd</TableHead>
                  <TableHead className="w-28 text-right">Unitário</TableHead>
                  <TableHead className="w-24 text-right">Desc.</TableHead>
                  <TableHead className="w-28 text-right">Subtotal</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {grid.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{pieceLetter(line.pieceId)}</TableCell>
                    <TableCell className="text-sm">
                      {describe(line, programs, costMetrics) || <span className="text-muted-foreground">—</span>}
                      {line.isBonus && (
                        <Badge variant="secondary" className="ml-2">
                          Bonificação
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {line.biweeks?.length
                        ? `Bi-semanas ${line.biweeks.join(', ')}`
                        : line.dailyInsertions
                          ? `${Object.keys(line.dailyInsertions).length} dia(s)`
                          : line.startDate
                            ? `${formatDate(line.startDate)} a ${formatDate(line.endDate)}`
                            : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.insertions}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(line.unitValue)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.discountValue > 0
                        ? line.discountType === 'PERCENT'
                          ? `${line.discountValue}%`
                          : formatMoney(line.discountValue)
                        : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${line.isBonus ? 'text-muted-foreground line-through' : ''}`}
                    >
                      {formatMoney(line.subtotal)}
                    </TableCell>
                    <TableCell>
                      {editable && (
                        <div className="flex">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Editar linha"
                            onClick={() => setDialog({ line })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Excluir linha"
                            onClick={() => void run(() => api.media.removeLine(media.id, line.id))}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {editable ? (
            <Button variant="outline" size="sm" onClick={() => setDialog({ line: null })}>
              <Plus /> Adicionar linha
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {grid.totals.insertions} inserções · desconto {formatMoney(grid.totals.discount)} · bonificação{' '}
            {formatMoney(grid.totals.bonus)} ·{' '}
            <strong className="text-foreground">{formatMoney(grid.totals.total)}</strong>
          </span>
        </div>
      </CardContent>
      {dialog && (
        <LineDialog
          key={dialog.line?.id ?? 'new'}
          media={media}
          grid={grid}
          line={dialog.line}
          programs={programs}
          costMetrics={costMetrics}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onSave={saveLine}
        />
      )}
    </Card>
  );
}
