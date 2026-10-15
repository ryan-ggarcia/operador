'use client';

import { ArrowLeftRight, ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState, ErrorMessage, Loading, PageHeader } from '@/components/common';
import { BillDialog, TransferDialog } from '@/components/finance/bill-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { formatDay, formatMoney, toLocalDateInput } from '@/lib/format';
import { api } from '@/services';
import { categoryLabel, type Bill, type BillKind } from '@/services/finance.service';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Primeiro dia do mês (AAAA-MM-01) somando meses. */
function monthStart(base: string, offset: number): string {
  const [year, month] = base.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 10);
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="py-3">
      <CardContent className="px-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold tabular-nums ${tone ?? ''}`}>{formatMoney(value)}</div>
      </CardContent>
    </Card>
  );
}

const SITUATION: Record<Bill['situation'], { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  OPEN: { label: 'Em aberto', variant: 'outline' },
  PAID: { label: 'Quitado', variant: 'secondary' },
  CANCELED: { label: 'Cancelado', variant: 'destructive' },
};

export default function FinancePage() {
  const { permissions } = useAuth();
  const today = toLocalDateInput(new Date().toISOString());
  const [month, setMonth] = useState(() => monthStart(today, 0));
  const [kind, setKind] = useState<'all' | BillKind>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<BillKind | 'transfer' | null>(null);
  const next = monthStart(month, 1);

  const bills = useResource(
    () => api.finance.bills({ from: month, to: next, kinds: kind === 'all' ? undefined : [kind], search: query || undefined, limit: 200 }),
    [month, kind, query],
  );
  const summary = useResource(() => api.finance.summary(month, next), [month]);
  const transfers = useResource(() => api.finance.transfers(month, next), [month]);
  const categories = useResource(() => api.finance.categories(), []);
  const accounts = useResource(() => api.finance.accounts(), []);
  const methods = useResource(() => api.finance.paymentMethods(), []);

  const reload = () => void Promise.all([bills.reload(), summary.reload(), transfers.reload(), accounts.reload()]);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  function cancel(bill: Bill) {
    if (bill.installmentCount > 1) {
      const answer = prompt('Cancelar qual parte do parcelamento?\n1 = só esta parcela\n2 = esta e as próximas em aberto\n3 = todas em aberto', '1');
      const scope = answer === '2' ? 'next' : answer === '3' ? 'all' : answer === '1' ? 'this' : null;
      if (scope) void run(() => api.finance.cancel(bill.id, scope), 'Cancelado.');
    } else if (confirm('Cancelar este lançamento?')) {
      void run(() => api.finance.cancel(bill.id), 'Cancelado.');
    }
  }

  function settle(bill: Bill) {
    const date = prompt('Data do pagamento (AAAA-MM-DD):', today);
    if (date) void run(() => api.finance.settle([bill.id], date), 'Quitado.');
  }

  const accountName = (id: string) => accounts.data?.find((item) => item.id === id)?.name ?? '—';
  const [year, monthNumber] = month.split('-').map(Number);
  const ready = categories.data && accounts.data && methods.data;

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Contas a receber e a pagar, por mês de vencimento (ou de pagamento, quando quitado)."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/financeiro/configuracoes">Contas e categorias</Link>
            </Button>
            {permissions?.flags.financialTransfers && (
              <Button variant="outline" disabled={!ready} onClick={() => setDialog('transfer')}>
                <ArrowLeftRight /> Transferência
              </Button>
            )}
            {permissions?.flags.financialExpenses && (
              <Button variant="outline" disabled={!ready} onClick={() => setDialog('EXPENSE')}>
                <Minus /> Despesa
              </Button>
            )}
            {permissions?.flags.financialRevenues && (
              <Button disabled={!ready} onClick={() => setDialog('REVENUE')}>
                <Plus /> Receita
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMonth(monthStart(month, -1))}>
            <ChevronLeft />
          </Button>
          <span className="w-36 text-center font-medium capitalize">
            {MONTHS[monthNumber - 1]} {year}
          </span>
          <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMonth(next)}>
            <ChevronRight />
          </Button>
        </div>
        <Tabs value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="REVENUE">Receitas</TabsTrigger>
            <TabsTrigger value="EXPENSE">Despesas</TabsTrigger>
          </TabsList>
        </Tabs>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Input
            className="w-64"
            placeholder="Título, nº doc ou referência"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => setQuery(search.trim())}
          />
        </form>
      </div>

      {summary.data && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Recebido" value={summary.data.revenuePaid} tone="text-green-700" />
          <Metric label="A receber" value={summary.data.revenueOpen} />
          <Metric label="Pago" value={summary.data.expensePaid} tone="text-destructive" />
          <Metric label="A pagar" value={summary.data.expenseOpen} />
          <Metric label="Saldo realizado" value={summary.data.realizedBalance} />
          <Metric label="Saldo previsto" value={summary.data.forecastBalance} />
        </div>
      )}
      {summary.data && (summary.data.overdueRevenue > 0 || summary.data.overdueExpense > 0) && (
        <p className="mb-4 text-sm text-destructive">
          Em aberto de meses anteriores: {formatMoney(summary.data.overdueRevenue)} a receber e{' '}
          {formatMoney(summary.data.overdueExpense)} a pagar.
        </p>
      )}

      <ErrorMessage error={bills.error} />
      {bills.loading && !bills.data ? (
        <Loading />
      ) : bills.data?.items.length === 0 ? (
        <EmptyState>Nenhum lançamento neste mês.</EmptyState>
      ) : (
        bills.data && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Venc./Pagto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Sacado / cedente</TableHead>
                  <TableHead className="w-28">Situação</TableHead>
                  <TableHead className="w-32 text-right">Valor</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.data.items.map((bill) => (
                  <TableRow key={bill.id} className={bill.situation === 'CANCELED' ? 'opacity-50' : ''}>
                    <TableCell className={`tabular-nums ${bill.overdue ? 'font-medium text-destructive' : ''}`}>
                      {formatDay(bill.paidAt ?? bill.dueDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {categories.data?.find((item) => item.id === bill.categoryId)
                        ? categoryLabel(categories.data.find((item) => item.id === bill.categoryId)!, categories.data)
                        : bill.categoryName}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {bill.title}
                        {bill.installmentCount > 1 && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {bill.installmentNumber}/{bill.installmentCount}
                          </span>
                        )}
                      </div>
                      {bill.sourceType === 'MEDIA' && bill.sourceId && (
                        <Link href={`/midia/${bill.sourceId}`} className="text-xs text-muted-foreground hover:underline">
                          Gerado pela mídia
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{bill.party?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={SITUATION[bill.situation].variant}>{SITUATION[bill.situation].label}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${bill.kind === 'REVENUE' ? 'text-green-700' : 'text-destructive'}`}
                    >
                      {bill.kind === 'EXPENSE' && '− '}
                      {formatMoney(bill.finalAmount)}
                    </TableCell>
                    <TableCell>
                      {bill.can.edit && (
                        <div className="flex justify-end gap-1">
                          {bill.situation === 'OPEN' && (
                            <Button size="xs" variant="outline" onClick={() => settle(bill)}>
                              Quitar
                            </Button>
                          )}
                          {bill.situation === 'OPEN' && bill.sourceType === 'MANUAL' && (
                            <Button size="icon-xs" variant="ghost" aria-label="Cancelar" onClick={() => cancel(bill)}>
                              <XCircle />
                            </Button>
                          )}
                          {bill.situation !== 'OPEN' && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              aria-label="Reabrir"
                              onClick={() => void run(() => api.finance.reopen(bill.id), 'Reaberto.')}
                            >
                              <RotateCcw />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
      {bills.data && (
        <p className="mt-3 text-sm text-muted-foreground">
          {bills.data.items.length} lançamento(s) · receitas {formatMoney(bills.data.totals.revenue)} · despesas{' '}
          {formatMoney(bills.data.totals.expense)}
        </p>
      )}

      {transfers.data && transfers.data.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium">Transferências do mês</h2>
          <div className="rounded-lg border">
            <Table>
              <TableBody>
                {transfers.data.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="w-28 tabular-nums">{formatDay(transfer.date)}</TableCell>
                    <TableCell>
                      {transfer.title}
                      {transfer.scheduled && <Badge variant="outline" className="ml-2">Agendada</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {accountName(transfer.fromAccountId)} → {accountName(transfer.toAccountId)}
                    </TableCell>
                    <TableCell className="w-32 text-right tabular-nums">{formatMoney(transfer.amount)}</TableCell>
                    <TableCell className="w-10">
                      {permissions?.flags.financialTransfers && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label="Excluir transferência"
                          onClick={() =>
                            confirm('Excluir esta transferência?') &&
                            void run(() => api.finance.removeTransfer(transfer.id), 'Transferência excluída.')
                          }
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
        </div>
      )}

      {ready && (dialog === 'REVENUE' || dialog === 'EXPENSE') && (
        <BillDialog
          key={dialog}
          kind={dialog}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          categories={categories.data!}
          accounts={accounts.data!}
          paymentMethods={methods.data!}
          onCreated={reload}
        />
      )}
      {ready && dialog === 'transfer' && (
        <TransferDialog open onOpenChange={(open) => !open && setDialog(null)} accounts={accounts.data!} onCreated={reload} />
      )}
    </>
  );
}
