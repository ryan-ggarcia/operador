'use client';

import { Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { ErrorMessage, Loading } from '@/components/common';
import { BILLING_LABEL } from '@/components/media/media-terms';
import { Button } from '@/components/ui/button';
import { useResource } from '@/hooks/use-resource';
import { formatDay, formatDocument, formatMoney } from '@/lib/format';
import { api } from '@/services';
import { MEDIA_TYPE_LABEL, type MediaLine } from '@/services/media.service';
import type { Party } from '@/services/types';

/** Cadastro completo (CNPJ); sem permissão de ver o cadastro, fica só o nome. */
const partyOrNull = (id: string | undefined) => (id ? api.parties.get(id).catch(() => null) : Promise.resolve(null));

function PartyBlock({ title, name, party }: { title: string; name?: string; party: Party | null }) {
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold text-muted-foreground uppercase">{title}</div>
      <div className="font-medium">{party?.legalName || name || '—'}</div>
      {party?.document && <div>{formatDocument(party.document)}</div>}
      {party && [party.street, party.number, party.city, party.state].some(Boolean) && (
        <div>{[party.street, party.number, party.district, party.city, party.state].filter(Boolean).join(', ')}</div>
      )}
    </div>
  );
}

/**
 * PI para imprimir ou salvar em PDF pelo navegador (Ctrl+P).
 * shortcut: layout fixo, sem as preferências do PDF do Operand; criar opções se a agência pedir.
 */
export default function MediaPiPage() {
  const { id } = useParams<{ id: string }>();
  const media = useResource(() => api.media.get(id), [id]);
  const agency = useResource(() => api.settings.agency(), []);
  const logo = useResource(() => api.files.agencyLogoUrl().catch(() => null), []);
  const parties = useResource(
    () => Promise.all([partyOrNull(media.data?.client?.id), partyOrNull(media.data?.vehicle?.id)]),
    [media.data?.client?.id, media.data?.vehicle?.id],
  );
  const programs = useResource(() => {
    const type = media.data?.mediaType;
    return type === 'TV' || type === 'RADIO' ? api.media.programs({ mediaType: type }) : Promise.resolve([]);
  }, [media.data?.mediaType]);

  if (media.loading && !media.data) return <Loading />;
  if (!media.data) return <ErrorMessage error={media.error} />;
  const data = media.data;
  const [client, vehicle] = parties.data ?? [null, null];
  const piece = (pieceId: string | null) => data.pieces.find((item) => item.id === pieceId);
  const program = (programId: string | null) => programs.data?.find((item) => item.id === programId)?.name;
  const describe = (line: MediaLine) =>
    [
      program(line.programId),
      line.product,
      line.location,
      line.section,
      line.position,
      line.format,
      line.color,
      line.placementType,
    ]
      .filter(Boolean)
      .join(' · ') || '—';

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black print:max-w-none print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer /> Imprimir / salvar PDF
        </Button>
      </div>

      <header className="flex items-start justify-between gap-6 border-b pb-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do storage */}
          {logo.data && <img src={logo.data} alt="Logo da agência" className="max-h-16 max-w-40 object-contain" />}
          <div className="text-sm">
            <div className="text-base font-semibold">{agency.data?.tradeName || agency.data?.legalName}</div>
            {agency.data?.legalName && <div>{agency.data.legalName}</div>}
            {agency.data?.cnpj && <div>CNPJ {formatDocument(agency.data.cnpj)}</div>}
            <div>{[agency.data?.email, agency.data?.phone].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-lg font-semibold">Pedido de Inserção</div>
          <div className="text-2xl font-bold tabular-nums">{data.number}</div>
          <div>
            Emissão: {data.documentDate ? formatDay(data.documentDate) : new Date().toLocaleDateString('pt-BR')}
          </div>
          {data.estimateNumber && <div>Orçamento: {data.estimateNumber}</div>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 border-b py-4">
        <PartyBlock title="Veículo" name={data.vehicle?.name} party={vehicle} />
        <PartyBlock title="Cliente (anunciante)" name={data.client?.name} party={client} />
        <div className="text-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase">Campanha</div>
          <div className="font-medium">{data.title}</div>
          <div>
            {MEDIA_TYPE_LABEL[data.mediaType]}
            {data.channel && ` · ${data.channel}`}
            {data.target && ` · público: ${data.target}`}
          </div>
        </div>
        {data.pieces.length > 0 && (
          <div className="text-sm">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Peças</div>
            {data.pieces.map((item) => (
              <div key={item.id}>
                {item.letter} — {item.title}
              </div>
            ))}
          </div>
        )}
      </section>

      {data.grids.map((grid) => (
        <section key={grid.id} className="break-inside-avoid border-b py-4">
          <div className="mb-2 text-sm font-semibold">
            {grid.marketName ?? 'Grade'}
            {(grid.periodStart || grid.periodEnd) && ` · ${formatDay(grid.periodStart)} a ${formatDay(grid.periodEnd)}`}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                <th className="py-1 pr-2">Peça</th>
                <th className="py-1 pr-2">Descrição</th>
                <th className="py-1 pr-2">Período</th>
                <th className="py-1 pr-2 text-right">Inserções</th>
                <th className="py-1 pr-2 text-right">Unitário</th>
                <th className="py-1 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {grid.lines.map((line) => (
                <tr key={line.id} className="border-b last:border-0">
                  <td className="py-1 pr-2">{piece(line.pieceId)?.letter ?? '—'}</td>
                  <td className="py-1 pr-2">
                    {describe(line)}
                    {line.isBonus && <span className="ml-1 text-xs">(bonificação)</span>}
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {line.startDate ? `${formatDay(line.startDate)} a ${formatDay(line.endDate)}` : '—'}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">{line.insertions}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(line.unitValue)}</td>
                  <td className="py-1 text-right tabular-nums">{line.isBonus ? '—' : formatMoney(line.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {data.totals && (
        <section className="ml-auto grid w-80 gap-1 py-4 text-sm">
          <div className="flex justify-between">
            <span>Valor bruto</span>
            <span className="tabular-nums">{formatMoney(data.totals.gridsTotal)}</span>
          </div>
          {data.totals.generalDiscount > 0 && (
            <div className="flex justify-between">
              <span>Desconto</span>
              <span className="tabular-nums">− {formatMoney(data.totals.generalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Valor total</span>
            <span className="tabular-nums">{formatMoney(data.totals.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Comissão da agência</span>
            <span className="tabular-nums">{formatMoney(data.totals.partial)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Valor líquido</span>
            <span className="tabular-nums">{formatMoney(data.totals.net)}</span>
          </div>
        </section>
      )}

      <section className="grid gap-1 border-t py-4 text-sm">
        {data.billingType && <div>Faturamento: {BILLING_LABEL[data.billingType]}</div>}
        {data.firstDueDate && <div>1º vencimento: {formatDay(data.firstDueDate)}</div>}
        {data.paymentCondition && <div>Condição de pagamento: {data.paymentCondition}</div>}
        {data.vehicleNotes && <div className="mt-2 whitespace-pre-line">Observações: {data.vehicleNotes}</div>}
      </section>

      <section className="mt-16 grid grid-cols-3 gap-8 text-center text-xs break-inside-avoid">
        {['Agência', 'Veículo', 'Cliente'].map((label) => (
          <div key={label} className="border-t border-black pt-1">
            {label}
          </div>
        ))}
      </section>
    </div>
  );
}
