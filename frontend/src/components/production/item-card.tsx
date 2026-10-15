'use client';

import { Check, Lock, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PartyPicker } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/format';
import { api } from '@/services';
import type { ItemInput, Production, ProductionItem } from '@/services/production.service';

const quantityLabel = (quantity: number) => quantity.toLocaleString('pt-BR');

/** Lê "500, 1.000, 2000" como lista de quantidades. */
export function parseQuantities(text: string): number[] {
  return text
    .split(/[;,\s]+/)
    .map((part) => Number(part.replace(/\./g, '').replace(',', '.')))
    .filter((value) => value > 0);
}

export function ItemForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: ProductionItem;
  onSubmit: (input: ItemInput) => Promise<void>;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [quantities, setQuantities] = useState(initial?.quantities.map(quantityLabel).join(', ') ?? '');
  const [commission, setCommission] = useState(String(initial?.commissionValue ?? 0));
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSubmit({
            title,
            description: description || null,
            quantities: parseQuantities(quantities),
            commissionType: 'PERCENT',
            commissionValue: Number(commission.replace(',', '.')) || 0,
          });
          if (!initial) {
            setTitle('');
            setDescription('');
            setQuantities('');
          }
        } catch (caught) {
          toast.error((caught as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <Input
        className="w-56"
        placeholder="Item (ex.: folder A4)"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        className="w-56"
        placeholder="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        className="w-48"
        placeholder="Quantidades: 500, 1000"
        required
        value={quantities}
        onChange={(e) => setQuantities(e.target.value)}
      />
      <div className="flex items-center gap-1">
        <Input
          className="w-20"
          aria-label="BV (%)"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
        />
        <span className="text-sm text-muted-foreground">% BV</span>
      </div>
      <Button type="submit" variant="outline" disabled={saving}>
        {submitLabel}
      </Button>
    </form>
  );
}

/** Item da cotação: fornecedores × quantidades, com valor e aprovação. */
export function ItemCard({
  production,
  item,
  onChange,
}: {
  production: Production;
  item: ProductionItem;
  onChange: (production: Production) => void;
}) {
  const [editing, setEditing] = useState(false);
  const editable = production.can.edit;

  async function run(action: () => Promise<Production>) {
    try {
      onChange(await action());
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="mr-1.5 text-muted-foreground tabular-nums">{item.number}</span>
          {item.title}
          {item.commissionValue > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              BV {item.commissionType === 'PERCENT' ? `${item.commissionValue}%` : formatMoney(item.commissionValue)}
            </span>
          )}
        </CardTitle>
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
        {editable && (
          <CardAction className="flex gap-1">
            <Button variant="ghost" size="icon-sm" title="Editar item" onClick={() => setEditing((value) => !value)}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Excluir item"
              onClick={() =>
                confirm('Excluir o item e as cotações dele?') &&
                void run(() => api.production.removeItem(production.id, item.id))
              }
            >
              <Trash2 />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing && (
          <ItemForm
            initial={item}
            submitLabel="Salvar item"
            onSubmit={async (input) => {
              onChange(await api.production.updateItem(production.id, item.id, input));
              setEditing(false);
            }}
          />
        )}
        {item.suppliers.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  {item.quantities.map((quantity) => (
                    <TableHead key={quantity} className="w-44 text-right">
                      {quantityLabel(quantity)} un.
                    </TableHead>
                  ))}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      {supplier.supplier?.name}
                      {supplier.locked && <Lock className="ml-1.5 inline size-3.5 text-muted-foreground" />}
                    </TableCell>
                    {item.quantities.map((quantity) => {
                      const quote = supplier.quotes.find((current) => current.quantity === quantity);
                      return (
                        <TableCell
                          key={quantity}
                          className={`text-right ${quote?.approved ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              key={`${quote?.id}-${quote?.unitValue}`}
                              aria-label={`Valor unitário para ${quantity}`}
                              className="h-7 w-24 text-right"
                              inputMode="decimal"
                              disabled={!editable || supplier.locked}
                              defaultValue={quote ? String(quote.unitValue).replace('.', ',') : ''}
                              placeholder="unit."
                              onBlur={(event) => {
                                const value = Number(event.target.value.replace(',', '.'));
                                if (event.target.value === '' || value === quote?.unitValue) return;
                                void run(() => api.production.saveQuote(production.id, supplier.id, quantity, value));
                              }}
                            />
                            <Button
                              variant={quote?.approved ? 'default' : 'ghost'}
                              size="icon-xs"
                              title={quote?.approved ? 'Desaprovar' : 'Aprovar esta quantidade'}
                              disabled={!editable || supplier.locked || !quote}
                              onClick={() =>
                                void run(() =>
                                  api.production.approve(production.id, supplier.id, quote?.approved ? null : quantity),
                                )
                              }
                            >
                              <Check />
                            </Button>
                          </div>
                          {quote && (
                            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                              {formatMoney(quote.totalValue)}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      {editable && !supplier.locked && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Tirar fornecedor"
                          onClick={() => void run(() => api.production.removeSupplier(production.id, supplier.id))}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {editable && (
          <div className="w-72">
            <PartyPicker
              role="supplier"
              value={null}
              placeholder="Adicionar fornecedor à cotação"
              onChange={(supplier) =>
                supplier && void run(() => api.production.addSupplier(production.id, item.id, supplier.id))
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
