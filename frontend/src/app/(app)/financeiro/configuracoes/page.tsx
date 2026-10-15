'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { formatMoney } from '@/lib/format';
import { api } from '@/services';
import type { BillKind, Category } from '@/services/finance.service';

const NONE = '__none__';

async function attempt(action: () => Promise<unknown>, success: string): Promise<boolean> {
  try {
    await action();
    toast.success(success);
    return true;
  } catch (caught) {
    toast.error((caught as Error).message);
    return false;
  }
}

function CategoryTree({ kind, categories, canEdit, onChange }: { kind: BillKind; categories: Category[]; canEdit: boolean; onChange: () => void }) {
  const roots = categories.filter((category) => category.kind === kind && !category.parentId);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState(NONE);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{kind === 'REVENUE' ? 'Receitas' : 'Despesas'}</h3>
      <ul className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
        {roots.map((root) => (
          <li key={root.id}>
            <span className={root.active ? '' : 'text-muted-foreground line-through'}>{root.name}</span>
            <ul className="ml-4 border-l pl-3">
              {categories
                .filter((child) => child.parentId === root.id)
                .map((child) => (
                  <li key={child.id} className={child.active ? '' : 'text-muted-foreground line-through'}>
                    {child.name}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await attempt(
              () => api.finance.saveCategory(null, { name, kind, parentId: parentId === NONE ? null : parentId }),
              'Categoria criada.',
            );
            if (ok) {
              setName('');
              onChange();
            }
          }}
        >
          <Input className="w-56" placeholder="Nova categoria" required value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sem categoria mãe</SelectItem>
              {roots.map((root) => (
                <SelectItem key={root.id} value={root.id}>
                  Dentro de {root.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline">
            <Plus /> Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

/** Configurações › Financeiro: plano de contas, contas bancárias e formas de pagamento. */
export default function FinanceSettingsPage() {
  const { can } = useAuth();
  const canEdit = can('financial', 6);
  const categories = useResource(() => api.finance.categories(), []);
  const accounts = useResource(() => api.finance.accounts(), []);
  const methods = useResource(() => api.finance.paymentMethods(), []);
  const [account, setAccount] = useState({ name: '', bank: '', initialBalance: '' });
  const [method, setMethod] = useState('');

  return (
    <>
      <PageHeader
        title="Configurações do financeiro"
        description={canEdit ? undefined : 'Só quem tem permissão total no financeiro altera estes cadastros.'}
      />
      <Card>
        <CardContent>
          <Tabs defaultValue="categories">
            <TabsList>
              <TabsTrigger value="categories">Plano de contas</TabsTrigger>
              <TabsTrigger value="accounts">Contas bancárias</TabsTrigger>
              <TabsTrigger value="methods">Formas de pagamento</TabsTrigger>
            </TabsList>
            <TabsContent value="categories" className="grid gap-6 pt-4 md:grid-cols-2">
              {(['REVENUE', 'EXPENSE'] as const).map((kind) => (
                <CategoryTree
                  key={kind}
                  kind={kind}
                  categories={categories.data ?? []}
                  canEdit={canEdit}
                  onChange={() => void categories.reload()}
                />
              ))}
            </TabsContent>
            <TabsContent value="accounts" className="flex flex-col gap-3 pt-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead className="w-36 text-right">Saldo inicial</TableHead>
                      <TableHead className="w-36 text-right">Saldo hoje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.data?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.name}
                          {item.isDefault && <Badge variant="secondary" className="ml-2">Padrão</Badge>}
                        </TableCell>
                        <TableCell>{item.bank ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(item.initialBalance)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatMoney(item.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {canEdit && (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const ok = await attempt(
                      () =>
                        api.finance.saveAccount(null, {
                          name: account.name,
                          bank: account.bank || null,
                          initialBalance: Number(account.initialBalance.replace(',', '.')) || 0,
                        }),
                      'Conta criada.',
                    );
                    if (ok) {
                      setAccount({ name: '', bank: '', initialBalance: '' });
                      await accounts.reload();
                    }
                  }}
                >
                  <Input className="w-56" placeholder="Nome da conta" required value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
                  <Input className="w-40" placeholder="Banco" value={account.bank} onChange={(e) => setAccount({ ...account, bank: e.target.value })} />
                  <Input className="w-40" placeholder="Saldo inicial" inputMode="decimal" value={account.initialBalance} onChange={(e) => setAccount({ ...account, initialBalance: e.target.value })} />
                  <Button type="submit" variant="outline">
                    <Plus /> Adicionar
                  </Button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="methods" className="flex flex-col gap-3 pt-4">
              <div className="flex flex-wrap gap-2">
                {methods.data?.map((item) => (
                  <Badge key={item.id} variant={item.isDefault ? 'secondary' : 'outline'}>
                    {item.name}
                    {item.isDefault && ' (padrão)'}
                  </Badge>
                ))}
              </div>
              {canEdit && (
                <form
                  className="flex gap-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (await attempt(() => api.finance.savePaymentMethod(null, { name: method }), 'Forma de pagamento criada.')) {
                      setMethod('');
                      await methods.reload();
                    }
                  }}
                >
                  <Input className="w-56" placeholder="Nova forma de pagamento" required value={method} onChange={(e) => setMethod(e.target.value)} />
                  <Button type="submit" variant="outline">
                    <Plus /> Adicionar
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
