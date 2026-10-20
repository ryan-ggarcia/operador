'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PartyPicker } from '@/components/pickers';
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
import { Textarea } from '@/components/ui/textarea';
import { toLocalDateInput } from '@/lib/format';
import { api } from '@/services';
import {
  categoryLabel,
  type Account,
  type BillCondition,
  type BillKind,
  type BillPartyType,
  type Category,
  type Frequency,
  type NamedOption,
} from '@/services/finance.service';
import type { NamedRef, PartyRole } from '@/services/types';

const PARTY_ROLE: Partial<Record<BillPartyType, PartyRole>> = {
  CLIENT: 'client',
  SUPPLIER: 'supplier',
  PROVIDER: 'provider',
  VEHICLE: 'vehicle',
};
const PARTY_LABEL: Record<string, string> = {
  CLIENT: 'Cliente',
  SUPPLIER: 'Fornecedor',
  PROVIDER: 'Prestador',
  VEHICLE: 'Veículo',
};
const FREQUENCY_LABEL: Record<Frequency, string> = {
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  YEARLY: 'Anual',
};

/** Nova receita ou despesa (à vista, parcelada ou recorrente). */
export function BillDialog({
  kind,
  open,
  onOpenChange,
  categories,
  accounts,
  paymentMethods,
  onCreated,
}: {
  kind: BillKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  accounts: Account[];
  paymentMethods: NamedOption[];
  onCreated: () => void;
}) {
  const today = toLocalDateInput(new Date().toISOString());
  const [title, setTitle] = useState('');
  const [partyType, setPartyType] = useState<BillPartyType>(kind === 'REVENUE' ? 'CLIENT' : 'SUPPLIER');
  const [party, setParty] = useState<NamedRef | null>(null);
  const [client, setClient] = useState<NamedRef | null>(null);
  const kindCategories = categories.filter((category) => category.kind === kind && category.active);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState(
    () => accounts.find((item) => item.isDefault)?.id ?? accounts[0]?.id ?? '',
  );
  const [methodId, setMethodId] = useState(
    () => paymentMethods.find((item) => item.isDefault)?.id ?? paymentMethods[0]?.id ?? '',
  );
  const [amount, setAmount] = useState('');
  const [additions, setAdditions] = useState('');
  const [discounts, setDiscounts] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [condition, setCondition] = useState<BillCondition>('SINGLE');
  const [count, setCount] = useState('2');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [documentNumber, setDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [paid, setPaid] = useState(false);
  const [paidAt, setPaidAt] = useState(today);
  const [saving, setSaving] = useState(false);
  const number = (value: string) => Number(value.replace(',', '.')) || 0;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!party) {
      toast.error(kind === 'REVENUE' ? 'Escolha de quem a agência recebe.' : 'Escolha a quem a agência paga.');
      return;
    }
    setSaving(true);
    try {
      const bills = await api.finance.create({
        kind,
        partyType,
        partyId: party.id,
        title,
        categoryId,
        accountId,
        paymentMethodId: methodId,
        amount: number(amount),
        additions: condition === 'SINGLE' ? number(additions) : 0,
        discounts: condition === 'SINGLE' ? number(discounts) : 0,
        dueDate,
        condition,
        count: condition === 'SINGLE' ? undefined : Math.round(number(count)),
        frequency: condition === 'SINGLE' ? undefined : frequency,
        documentNumber: documentNumber || null,
        clientId: partyType === 'CLIENT' ? party.id : (client?.id ?? null),
        notes: notes || null,
        paidAt: paid && condition === 'SINGLE' ? paidAt : null,
      });
      toast.success(bills.length > 1 ? `${bills.length} parcelas lançadas.` : 'Lançamento criado.');
      onOpenChange(false);
      onCreated();
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
          <DialogTitle>{kind === 'REVENUE' ? 'Nova receita' : 'Nova despesa'}</DialogTitle>
          <DialogDescription>
            {kind === 'REVENUE' ? 'Valor que a agência vai receber.' : 'Valor que a agência vai pagar.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="bill-title">Título</Label>
            <Input id="bill-title" required maxLength={250} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="grid gap-2">
              <Label>{kind === 'REVENUE' ? 'Sacado' : 'Cedente'}</Label>
              <Select
                value={partyType}
                onValueChange={(value) => {
                  setPartyType(value as BillPartyType);
                  setParty(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PARTY_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>&nbsp;</Label>
              <PartyPicker role={PARTY_ROLE[partyType]!} value={party} onChange={setParty} placeholder="Escolha" />
            </div>
          </div>
          {partyType !== 'CLIENT' && (
            <div className="grid gap-2">
              <Label>Referente ao cliente (opcional)</Label>
              <PartyPicker role="client" value={client} onChange={setClient} placeholder="Nenhum" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2 sm:col-span-1">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {kindCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {categoryLabel(category, categories)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((item) => item.active)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods
                    .filter((item) => item.active)
                    .map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="bill-amount">Valor (R$)</Label>
              <Input
                id="bill-amount"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Condição</Label>
              <Select value={condition} onValueChange={(value) => setCondition(value as BillCondition)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">À vista</SelectItem>
                  <SelectItem value="INSTALLMENTS">Parcelado</SelectItem>
                  <SelectItem value="RECURRING">Recorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bill-due">{condition === 'SINGLE' ? 'Vencimento' : '1º vencimento'}</Label>
              <Input id="bill-due" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bill-doc">Nº doc / NF</Label>
              <Input id="bill-doc" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
            </div>
          </div>
          {condition === 'SINGLE' ? (
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="bill-additions">Acréscimos</Label>
                <Input
                  id="bill-additions"
                  inputMode="decimal"
                  value={additions}
                  onChange={(e) => setAdditions(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bill-discounts">Descontos</Label>
                <Input
                  id="bill-discounts"
                  inputMode="decimal"
                  value={discounts}
                  onChange={(e) => setDiscounts(e.target.value)}
                />
              </div>
              <Label className="flex items-center gap-2 self-end pb-2 font-normal">
                <Checkbox checked={paid} onCheckedChange={(value) => setPaid(value === true)} />
                Já {kind === 'REVENUE' ? 'recebido' : 'pago'}
              </Label>
              {paid && (
                <div className="grid gap-2">
                  <Label htmlFor="bill-paid">Data do pagamento</Label>
                  <Input id="bill-paid" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="bill-count">{condition === 'INSTALLMENTS' ? 'Parcelas' : 'Repetições'}</Label>
                <Input
                  id="bill-count"
                  type="number"
                  min={2}
                  max={120}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Frequência</Label>
                <Select value={frequency} onValueChange={(value) => setFrequency(value as Frequency)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="self-end pb-2 text-xs text-muted-foreground sm:col-span-2">
                {condition === 'INSTALLMENTS'
                  ? 'O valor é dividido entre as parcelas.'
                  : 'Cada repetição tem o valor cheio.'}
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="bill-notes">Observações</Label>
            <Textarea id="bill-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !categoryId}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Transferência entre contas (data futura fica agendada). */
export function TransferDialog({
  open,
  onOpenChange,
  accounts,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onCreated: () => void;
}) {
  const active = accounts.filter((item) => item.active);
  const [title, setTitle] = useState('Transferência entre contas');
  const [fromAccountId, setFrom] = useState(active[0]?.id ?? '');
  const [toAccountId, setTo] = useState(active[1]?.id ?? '');
  const [date, setDate] = useState(toLocalDateInput(new Date().toISOString()));
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const transfer = await api.finance.createTransfer({
        title,
        fromAccountId,
        toAccountId,
        date,
        amount: Number(amount.replace(',', '.')) || 0,
      });
      toast.success(transfer.scheduled ? 'Transferência agendada.' : 'Transferência registrada.');
      onOpenChange(false);
      onCreated();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const accountSelect = (value: string, onChange: (value: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Conta" />
      </SelectTrigger>
      <SelectContent>
        {active.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferência entre contas</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="transfer-title">Título</Label>
            <Input id="transfer-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>De</Label>
              {accountSelect(fromAccountId, setFrom)}
            </div>
            <div className="grid gap-2">
              <Label>Para</Label>
              {accountSelect(toAccountId, setTo)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="transfer-date">Data</Label>
              <Input id="transfer-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transfer-amount">Valor (R$)</Label>
              <Input
                id="transfer-amount"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Transferir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
