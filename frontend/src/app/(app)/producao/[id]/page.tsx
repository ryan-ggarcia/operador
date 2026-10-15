'use client';

import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  EmptyState,
  ErrorMessage,
  Loading,
  PageHeader,
  SituationBadge,
  UserAvatar,
  UserList,
} from '@/components/common';
import { ItemCard, ItemForm } from '@/components/production/item-card';
import { OrderCard } from '@/components/production/order-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { formatDate, formatDeadline, formatMoney } from '@/lib/format';
import { api } from '@/services';
import type { Production } from '@/services/production.service';

const NONE = '__none__';

type Tax = { id: string; title: string; percent: number; active: boolean };
type Status = { id: string; name: string; color: string; active: boolean };

/** Condições gerais do orçamento ao cliente. */
function GeneralForm({
  production,
  taxes,
  statuses,
  onSaved,
}: {
  production: Production;
  taxes: Tax[];
  statuses: Status[];
  onSaved: (production: Production) => void;
}) {
  const [form, setForm] = useState({
    title: production.title,
    statusId: production.statusId,
    taxId: production.taxId,
    validityDays: production.validityDays == null ? '' : String(production.validityDays),
    paymentConditions: production.paymentConditions ?? '',
    clientNotes: production.clientNotes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const editable = production.can.edit;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      onSaved(
        await api.production.update(production.id, {
          title: form.title,
          statusId: form.statusId,
          taxId: form.taxId,
          validityDays: form.validityDays === '' ? null : Number(form.validityDays),
          paymentConditions: form.paymentConditions || null,
          clientNotes: form.clientNotes || null,
        }),
      );
      toast.success('Produção salva.');
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="production-title">Título</Label>
          <Input
            id="production-title"
            required
            disabled={!editable}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={form.statusId ?? NONE}
            disabled={!editable}
            onValueChange={(value) => setForm({ ...form, statusId: value === NONE ? null : value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem status</SelectItem>
              {statuses
                .filter((status) => status.active || status.id === form.statusId)
                .map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Encargo</Label>
          <Select
            value={form.taxId ?? NONE}
            disabled={!editable}
            onValueChange={(value) => setForm({ ...form, taxId: value === NONE ? null : value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {taxes
                .filter((tax) => tax.active || tax.id === form.taxId)
                .map((tax) => (
                  <SelectItem key={tax.id} value={tax.id}>
                    {tax.title} ({tax.percent}%)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="production-validity">Validade (dias)</Label>
          <Input
            id="production-validity"
            type="number"
            min={0}
            disabled={!editable}
            value={form.validityDays}
            onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="production-payment">Condições de pagamento</Label>
          <Input
            id="production-payment"
            disabled={!editable}
            value={form.paymentConditions}
            onChange={(e) => setForm({ ...form, paymentConditions: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="production-notes">Observações ao cliente</Label>
        <Textarea
          id="production-notes"
          rows={2}
          disabled={!editable}
          value={form.clientNotes}
          onChange={(e) => setForm({ ...form, clientNotes: e.target.value })}
        />
      </div>
      {editable && (
        <div>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </div>
      )}
    </form>
  );
}

export default function ProductionPage() {
  const { id } = useParams<{ id: string }>();
  const production = useResource(() => api.production.get(id), [id]);
  const taxes = useResource(() => api.production.taxes(), []);
  const statuses = useResource(() => api.production.statuses(), []);
  const [acting, setActing] = useState(false);

  async function act(action: 'complete' | 'cancel' | 'reopen') {
    setActing(true);
    try {
      production.setData(await api.production.act(id, action));
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  if (production.loading && !production.data) return <Loading />;
  if (!production.data) return <ErrorMessage error={production.error} />;
  const data = production.data;
  const items = data.items ?? [];
  const orders = data.orders ?? [];
  const status = statuses.data?.find((item) => item.id === data.statusId);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground tabular-nums">{data.number}</span> {data.title}
            <SituationBadge situation={data.situation} />
            {status && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
                <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
                {status.name}
              </span>
            )}
          </span>
        }
        description={
          <>
            {data.client?.name}
            {data.project && (
              <>
                {' · '}
                <Link href={`/projetos/${data.project.id}`} className="hover:underline">
                  {data.project.number} {data.project.title}
                </Link>
              </>
            )}
          </>
        }
        actions={
          data.can.act &&
          (data.situation === 'OPEN' ? (
            <>
              <Button variant="outline" disabled={acting} onClick={() => void act('cancel')}>
                <XCircle /> Cancelar
              </Button>
              <Button disabled={acting} onClick={() => void act('complete')}>
                <CheckCircle2 /> Concluir
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={acting} onClick={() => void act('reopen')}>
              <RotateCcw /> Reabrir
            </Button>
          ))
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Tabs defaultValue="quote" className="min-w-0">
          <TabsList>
            <TabsTrigger value="quote">Cotação ({items.length})</TabsTrigger>
            <TabsTrigger value="orders">Pedidos ({orders.length})</TabsTrigger>
            <TabsTrigger value="general">Dados gerais</TabsTrigger>
          </TabsList>

          <TabsContent value="quote" className="flex flex-col gap-4">
            {items.length === 0 && <EmptyState>Nenhum item. Adicione o primeiro abaixo.</EmptyState>}
            {items.map((item) => (
              <ItemCard key={item.id} production={data} item={item} onChange={production.setData} />
            ))}
            {data.can.edit && (
              <Card>
                <CardHeader>
                  <CardTitle>Novo item</CardTitle>
                </CardHeader>
                <CardContent>
                  <ItemForm
                    submitLabel="Adicionar item"
                    onSubmit={async (input) => production.setData(await api.production.addItem(id, input))}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="orders" className="flex flex-col gap-4">
            {orders.length === 0 ? (
              <EmptyState>Aprove uma quantidade de um fornecedor na cotação para gerar o pedido.</EmptyState>
            ) : (
              orders.map((order) => (
                <OrderCard
                  key={`${order.id}-${data.updatedAt}`}
                  production={data}
                  order={order}
                  onChange={production.setData}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardContent>
                <GeneralForm
                  key={data.updatedAt}
                  production={data}
                  taxes={taxes.data ?? []}
                  statuses={statuses.data ?? []}
                  onSaved={production.setData}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Totais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5 text-sm">
              <div className="flex justify-between font-semibold">
                <span>Valor aprovado</span>
                <span className="tabular-nums">{formatMoney(data.totalValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BV total</span>
                <span className="tabular-nums">{formatMoney(data.commissionTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedidos enviados ao financeiro</span>
                <span className="tabular-nums">
                  {orders.filter((order) => order.sentToFinanceAt).length} de {orders.length}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-3 text-sm">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Responsável</span>
                <span className="flex items-center gap-2">
                  <UserAvatar user={data.responsible} size="sm" /> {data.responsible?.name}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Envolvidos</span>
                <UserList users={data.members} />
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Prazo</span>
                <span className={data.overdue ? 'font-medium text-destructive' : ''}>
                  {formatDeadline(data.deadline, false)}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Criada em</span>
                {formatDate(data.createdAt)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
