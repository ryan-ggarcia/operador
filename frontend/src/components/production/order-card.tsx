'use client';

import { AlertTriangle, Loader2, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BILLING_LABEL } from '@/components/media/media-terms';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/lib/format';
import { api } from '@/services';
import type { BillingType, PlannedInvoice } from '@/services/media.service';
import type { Production, PurchaseOrder } from '@/services/production.service';

const NONE = '__none__';

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${strong ? 'font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

/** Pedido de produção (PP) de um fornecedor: faturamento, entrega e envio. */
export function OrderCard({
  production,
  order,
  onChange,
}: {
  production: Production;
  order: PurchaseOrder;
  onChange: (production: Production) => void;
}) {
  const editable = production.can.edit && !order.sentToFinanceAt;
  const [form, setForm] = useState({
    billingType: order.billingType,
    discount: String(order.discount).replace('.', ','),
    negotiated: order.negotiatedCommission == null ? '' : String(order.negotiatedCommission).replace('.', ','),
    firstDueDate: order.firstDueDate?.slice(0, 10) ?? '',
    deliveryDate: order.deliveryDate?.slice(0, 10) ?? '',
    deliveryPlace: order.deliveryPlace ?? '',
    supplierNotes: order.supplierNotes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const party = (side: PlannedInvoice['payer']) =>
    side === 'agency'
      ? 'Agência'
      : side === 'client'
        ? (production.client?.name ?? 'Cliente')
        : (order.supplier?.name ?? 'Fornecedor');

  async function run(action: () => Promise<Production>, success?: string) {
    setBusy(true);
    try {
      onChange(await action());
      if (success) toast.success(success);
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          PP · {order.supplier?.name}
          {order.orderGroup > 0 && <Badge variant="outline">grupo {order.orderGroup}</Badge>}
          {order.sentToFinanceAt && <Badge variant="secondary">Enviado ao financeiro</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border">
            <Table>
              <TableBody>
                {order.lines.map((line) => (
                  <TableRow key={line.itemId}>
                    <TableCell className="text-muted-foreground tabular-nums">{line.number}</TableCell>
                    <TableCell>{line.title}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.quantity.toLocaleString('pt-BR')} un.
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(line.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () =>
                  api.production.updateOrder(production.id, order.id, {
                    billingType: form.billingType,
                    discount: Number(form.discount.replace(',', '.')) || 0,
                    negotiatedCommission: form.negotiated === '' ? null : Number(form.negotiated.replace(',', '.')),
                    firstDueDate: form.firstDueDate || null,
                    deliveryDate: form.deliveryDate || null,
                    deliveryPlace: form.deliveryPlace || null,
                    supplierNotes: form.supplierNotes || null,
                  }),
                'Pedido salvo.',
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tipo de faturamento</Label>
                <Select
                  value={form.billingType ?? NONE}
                  disabled={!editable}
                  onValueChange={(value) =>
                    setForm({ ...form, billingType: value === NONE ? null : (value as BillingType) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não definido</SelectItem>
                    {Object.entries(BILLING_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`due-${order.id}`}>1º vencimento</Label>
                <Input
                  id={`due-${order.id}`}
                  type="date"
                  disabled={!editable}
                  value={form.firstDueDate}
                  onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`discount-${order.id}`}>Desconto (R$)</Label>
                <Input
                  id={`discount-${order.id}`}
                  inputMode="decimal"
                  disabled={!editable}
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`negotiated-${order.id}`}>BV negociado (R$)</Label>
                <Input
                  id={`negotiated-${order.id}`}
                  inputMode="decimal"
                  placeholder="—"
                  disabled={!editable}
                  value={form.negotiated}
                  onChange={(e) => setForm({ ...form, negotiated: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`place-${order.id}`}>Local de entrega</Label>
                <Input
                  id={`place-${order.id}`}
                  disabled={!editable}
                  value={form.deliveryPlace}
                  onChange={(e) => setForm({ ...form, deliveryPlace: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`delivery-${order.id}`}>Data de entrega</Label>
                <Input
                  id={`delivery-${order.id}`}
                  type="date"
                  disabled={!editable}
                  value={form.deliveryDate}
                  onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`notes-${order.id}`}>Observações ao fornecedor</Label>
              <Textarea
                id={`notes-${order.id}`}
                rows={2}
                disabled={!editable}
                value={form.supplierNotes}
                onChange={(e) => setForm({ ...form, supplierNotes: e.target.value })}
              />
            </div>
            {editable && (
              <div>
                <Button type="submit" variant="outline" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  Salvar pedido
                </Button>
              </div>
            )}
          </form>
        </div>

        <div className="flex flex-col gap-3">
          {order.warnings.length > 0 && !order.sentToFinanceAt && (
            <Alert>
              <AlertTriangle />
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {order.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {order.totals && (
            <div className="grid gap-1.5">
              <Row label="Subtotal" value={order.totals.subtotal} />
              <Row label="Desconto" value={order.totals.discount} />
              <Row label="Valor total" value={order.totals.total} strong />
              <Separator className="my-1" />
              <Row label="BV (comissão)" value={order.totals.commission} />
              {order.totals.partial !== order.totals.commission && (
                <Row label="BV cobrado (negociado)" value={order.totals.partial} />
              )}
              <Row label="Valor líquido (fornecedor)" value={order.totals.net} strong />
              {order.totals.fee > 0 && <Row label="Honorários" value={order.totals.fee} />}
              {order.totals.tax > 0 && <Row label={`Encargo (${production.taxPercent}%)`} value={order.totals.tax} />}
            </div>
          )}
          {order.invoices.map((invoice) => (
            <div key={invoice.invoiceClass} className="flex justify-between gap-2 rounded-md border p-2 text-sm">
              <div>
                {party(invoice.payee)} recebe de {party(invoice.payer)}
                <div className="text-xs text-muted-foreground">
                  {invoice.kind
                    ? invoice.kind === 'REVENUE'
                      ? 'Receita da agência'
                      : 'Despesa da agência'
                    : 'Fora do caixa da agência'}
                </div>
              </div>
              <span className="font-medium tabular-nums">{formatMoney(invoice.amount)}</span>
            </div>
          ))}
          {production.can.edit &&
            (order.sentToFinanceAt ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  confirm('Reabrir o faturamento cancela as faturas deste pedido no financeiro. Continuar?') &&
                  void run(() => api.production.reopenOrder(production.id, order.id), 'Faturamento reaberto.')
                }
              >
                <RotateCcw /> Reabrir faturamento
              </Button>
            ) : (
              <Button
                disabled={busy || !order.billingType || !order.firstDueDate}
                onClick={() =>
                  confirm('Enviar as faturas deste pedido ao financeiro? Os itens do fornecedor ficam travados.') &&
                  void run(() => api.production.sendOrder(production.id, order.id), 'Pedido enviado ao financeiro.')
                }
              >
                <Send /> Enviar ao financeiro
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
