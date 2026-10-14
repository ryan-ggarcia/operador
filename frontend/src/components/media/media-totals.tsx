'use client';

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatMoney } from '@/lib/format';
import type { Media, PlannedInvoice } from '@/services/media.service';

function partyName(media: Media, party: PlannedInvoice['payer']): string {
  if (party === 'agency') return 'Agência';
  if (party === 'client') return media.client?.name ?? 'Cliente';
  return media.vehicle?.name ?? 'Veículo';
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${strong ? 'font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

/** Totais da mídia e as faturas que o tipo de faturamento vai gerar. */
export function MediaTotalsPanel({ media }: { media: Media }) {
  const totals = media.totals;
  return (
    <div className="flex flex-col gap-4">
      {media.warnings.length > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>
            <ul className="list-disc pl-4">
              {media.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {totals && (
        <div className="grid gap-1.5">
          <Row label="Total das grades" value={totals.gridsTotal} />
          <Row label="Desconto geral" value={totals.generalDiscount} />
          <Row label="Valor total" value={totals.total} strong />
          <Row label="Bonificação (informativo)" value={totals.bonusTotal} />
          <Separator className="my-1" />
          <Row label="Comissão" value={totals.commission} />
          {totals.partial !== totals.commission && <Row label="Comissão cobrada (negociada)" value={totals.partial} />}
          <Row label="Valor líquido (veículo)" value={totals.net} strong />
          {totals.fee > 0 && <Row label="Honorários" value={totals.fee} />}
        </div>
      )}
      {media.invoices.length > 0 && (
        <div className="grid gap-2">
          <span className="text-xs font-medium text-muted-foreground">Faturas que serão geradas</span>
          {media.invoices.map((invoice) => (
            <div
              key={invoice.invoiceClass}
              className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm"
            >
              <div>
                <div>
                  {partyName(media, invoice.payee)} recebe de {partyName(media, invoice.payer)}
                </div>
                {invoice.kind ? (
                  <Badge variant={invoice.kind === 'REVENUE' ? 'secondary' : 'outline'} className="mt-1">
                    {invoice.kind === 'REVENUE' ? 'Receita da agência' : 'Despesa da agência'}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Fora do caixa da agência</span>
                )}
              </div>
              <span className="font-medium tabular-nums">{formatMoney(invoice.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
