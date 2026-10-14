'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PartyPicker } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { api, ApiError } from '@/services';
import type { BillingType, Media, MediaHeaderInput, Network, ValueType } from '@/services/media.service';
import type { NamedRef } from '@/services/types';

const NONE = '__none__';

export const BILLING_LABEL: Record<BillingType, string> = {
  FLCC: 'FLCC — líquido contra o cliente',
  FBCC: 'FBCC — bruto contra o cliente',
  FLCA: 'FLCA — líquido contra a agência',
  FL_CCA: 'FL+CCA — líquido + comissão contra a agência',
  FBCA: 'FBCA — bruto contra a agência',
};

function ValueField({
  id,
  label,
  type,
  value,
  onType,
  onValue,
  disabled,
  allowEmpty,
}: {
  id: string;
  label: string;
  type: ValueType;
  value: number | null;
  onType?: (type: ValueType) => void;
  onValue: (value: number | null) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          step="0.01"
          disabled={disabled}
          value={value ?? ''}
          placeholder={allowEmpty ? '—' : undefined}
          onChange={(event) =>
            onValue(event.target.value === '' ? (allowEmpty ? null : 0) : Number(event.target.value))
          }
        />
        {onType ? (
          <Select value={type} onValueChange={(next) => onType(next as ValueType)} disabled={disabled}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT">%</SelectItem>
              <SelectItem value="AMOUNT">R$</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="grid w-20 place-items-center text-sm text-muted-foreground">
            {type === 'PERCENT' ? '%' : 'R$'}
          </span>
        )}
      </div>
    </div>
  );
}

/** Veículo, comissão, honorários, desconto geral e instruções de faturamento. */
export function MediaTerms({ media, onSaved }: { media: Media; onSaved: (media: Media) => void }) {
  const editable = media.can.edit;
  const broadcast = media.mediaType === 'TV' || media.mediaType === 'RADIO';
  const networks = useResource<Network[]>(() => (broadcast ? api.media.networks() : Promise.resolve([])), [broadcast]);
  const [vehicle, setVehicle] = useState<NamedRef | null>(media.vehicle);
  const contacts = useResource(() => (vehicle ? api.parties.contacts(vehicle.id) : Promise.resolve([])), [vehicle?.id]);
  const [form, setForm] = useState<MediaHeaderInput>({
    vehicleContactId: media.vehicleContact?.id ?? null,
    networkId: media.networkId,
    channel: media.channel,
    target: media.target,
    estimateNumber: media.estimateNumber,
    commissionType: media.commissionType,
    commissionValue: media.commissionValue,
    negotiatedCommission: media.negotiatedCommission,
    feeType: media.feeType,
    feeValue: media.feeValue,
    discountType: media.discountType,
    discountValue: media.discountValue,
    billingType: media.billingType,
    firstDueDate: media.firstDueDate?.slice(0, 10) ?? null,
    paymentCondition: media.paymentCondition,
    vehicleNotes: media.vehicleNotes,
    clientNotes: media.clientNotes,
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof MediaHeaderInput>(key: K, value: MediaHeaderInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const input: MediaHeaderInput = {
      ...form,
      vehicleId: vehicle?.id ?? null,
      channel: form.channel || null,
      target: form.target || null,
      estimateNumber: form.estimateNumber || null,
      paymentCondition: form.paymentCondition || null,
      firstDueDate: form.firstDueDate || null,
    };
    try {
      onSaved(await api.media.update(media.id, input));
      toast.success('Mídia salva.');
    } catch (caught) {
      // Trocar o veículo apaga as grades: confirma e manda de novo.
      const details = caught instanceof ApiError ? (caught.details as { code?: string; message?: string }) : null;
      if (details?.code === 'GRIDS_WILL_BE_CLEARED' && confirm(details.message)) {
        try {
          onSaved(await api.media.update(media.id, input, true));
          toast.success('Mídia salva. As grades foram apagadas.');
        } catch (again) {
          toast.error((again as Error).message);
        }
      } else {
        toast.error((caught as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Veículo</Label>
          <PartyPicker
            role="vehicle"
            value={vehicle}
            disabled={!editable}
            onChange={(value) => {
              setVehicle(value);
              set('vehicleContactId', null);
            }}
            placeholder="Escolha o veículo"
          />
        </div>
        <div className="grid gap-2">
          <Label>Contato do veículo</Label>
          <Select
            value={form.vehicleContactId ?? NONE}
            disabled={!editable || !vehicle}
            onValueChange={(value) => set('vehicleContactId', value === NONE ? null : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {contacts.data?.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {broadcast && (
          <>
            <div className="grid gap-2">
              <Label>Rede</Label>
              <Select
                value={form.networkId ?? NONE}
                disabled={!editable}
                onValueChange={(value) => set('networkId', value === NONE ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {networks.data?.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      {network.name} ({network.mnemonic})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="channel">Canal</Label>
              <Input
                id="channel"
                disabled={!editable}
                value={form.channel ?? ''}
                onChange={(e) => set('channel', e.target.value)}
              />
            </div>
          </>
        )}
        <div className="grid gap-2">
          <Label htmlFor="target">Target (público)</Label>
          <Input
            id="target"
            disabled={!editable}
            value={form.target ?? ''}
            onChange={(e) => set('target', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimate">Nº do orçamento</Label>
          <Input
            id="estimate"
            disabled={!editable}
            value={form.estimateNumber ?? ''}
            onChange={(e) => set('estimateNumber', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ValueField
          id="commission"
          label="Comissão"
          type={form.commissionType ?? 'PERCENT'}
          value={form.commissionValue ?? 0}
          disabled={!editable}
          onType={(type) => set('commissionType', type)}
          onValue={(value) => set('commissionValue', value ?? 0)}
        />
        <ValueField
          id="negotiated"
          label="Comissão negociada"
          type={form.commissionType ?? 'PERCENT'}
          value={form.negotiatedCommission ?? null}
          disabled={!editable}
          allowEmpty
          onValue={(value) => set('negotiatedCommission', value)}
        />
        <ValueField
          id="fee"
          label="Honorários"
          type={form.feeType ?? 'PERCENT'}
          value={form.feeValue ?? 0}
          disabled={!editable}
          onType={(type) => set('feeType', type)}
          onValue={(value) => set('feeValue', value ?? 0)}
        />
        <ValueField
          id="discount"
          label="Desconto geral"
          type={form.discountType ?? 'AMOUNT'}
          value={form.discountValue ?? 0}
          disabled={!editable}
          onType={(type) => set('discountType', type)}
          onValue={(value) => set('discountValue', value ?? 0)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2 sm:col-span-1">
          <Label>Tipo de faturamento</Label>
          <Select
            value={form.billingType ?? NONE}
            disabled={!editable}
            onValueChange={(value) => set('billingType', value === NONE ? null : (value as BillingType))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Escolha" />
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
          <Label htmlFor="first-due">1º vencimento</Label>
          <Input
            id="first-due"
            type="date"
            disabled={!editable}
            value={form.firstDueDate ?? ''}
            onChange={(e) => set('firstDueDate', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="condition">Condição de pagamento</Label>
          <Input
            id="condition"
            disabled={!editable}
            placeholder="Ex.: 30 dias"
            value={form.paymentCondition ?? ''}
            onChange={(e) => set('paymentCondition', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="vehicle-notes">Observações ao veículo</Label>
          <Textarea
            id="vehicle-notes"
            rows={3}
            disabled={!editable}
            value={form.vehicleNotes ?? ''}
            onChange={(e) => set('vehicleNotes', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client-notes">Observações ao cliente</Label>
          <Textarea
            id="client-notes"
            rows={3}
            disabled={!editable}
            value={form.clientNotes ?? ''}
            onChange={(e) => set('clientNotes', e.target.value)}
          />
        </div>
      </div>

      {editable && (
        <div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar condições
          </Button>
        </div>
      )}
    </form>
  );
}
