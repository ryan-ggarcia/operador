// Carga única das mídias do Operand (depois de import-operand.ts): veículos com contatos,
// redes, programas, praças, os projetos fechados que têm mídia e as mídias completas
// (peças, grades, linhas e condições de faturamento). Tudo numa transação.
// Recusa rodar se já houver mídias.
//
//   npx tsx prisma/import-operand-midias.ts --dry-run   (valida no banco e desfaz)
//   npx tsx prisma/import-operand-midias.ts
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import {
  allowsNegotiatedCommission,
  gridTotals,
  lineSubtotal,
  MediaMathError,
  mediaTotals,
  type BillingType,
  type LineValues,
} from '../src/modules/media/domain/media-math.js';
import { htmlToText, operandDate as date, operandDay as day, plain, readOperand as read, readOperandLines } from './operand-common.js';

const DRY = process.argv.includes('--dry-run');

const operandUsers: any[] = read('usuarios.json');
const operandClients: any[] = read('clientes.json');
const operandVehicles: any[] = read('veiculos.json');
const operandExtraProjects: any[] = read('projetos-extra.json');
const operandStatuses: { projeto: any[] } = read('status.json');
const mediaList: any[] = read('midias-lista.json');
const details = new Map(readOperandLines('midias.jsonl').map((media) => [Number(media.id), media]));

const TYPES: Record<string, 'TV' | 'RADIO' | 'NEWSPAPER' | 'MAGAZINE' | 'OOH' | 'INTERNET' | 'OTHER'> = {
  tv: 'TV', radio: 'RADIO', newspaper: 'NEWSPAPER', magazine: 'MAGAZINE', external: 'OOH', internet: 'INTERNET', other: 'OTHER',
};
const BILLING: Record<string, BillingType> = { 1: 'FLCC', 2: 'FBCC', 3: 'FLCA', 4: 'FL_CCA', 5: 'FBCA' };
const SITUATION = { active: 'OPEN', archived: 'DONE', removed: 'CANCELED' } as const;
const valueType = (value: string | undefined) => (value === 'percent' ? 'PERCENT' : 'AMOUNT') as 'PERCENT' | 'AMOUNT';
const money = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;
const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '') || null;
const active = (item: any) => !item?.eSituation || item.eSituation === 'active';
const list = (value: unknown): any[] => (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []);

/** Mesma chave do cadastro feito por import-operand.ts (ele não guardou o id do Operand). */
const partyKey = (p: { name: string; legalName: string | null; city: string | null; active: boolean }) =>
  [p.name.trim().toLowerCase(), p.legalName ?? '', p.city ?? '', p.active].join('|');

async function run(tx: Prisma.TransactionClient) {
  if (await tx.media.count()) throw new Error('Já existem mídias no banco: a carga só roda uma vez.');
  const missing = mediaList.filter((media) => !details.has(media.id)).map((media) => media.id);
  const report: Record<string, number> = { 'mídias sem detalhe (só cabeçalho)': missing.length };
  const bump = (key: string, by = 1) => (report[key] = (report[key] ?? 0) + by);

  // ---------- Usuários (por e-mail) ----------
  const userByEmail = new Map((await tx.userAccount.findMany()).map((u) => [u.email, u.id]));
  const userId = new Map<number, string>(
    operandUsers.map((u) => [u.id, userByEmail.get(u.email.trim().toLowerCase())!]).filter(([, id]) => id) as [number, string][],
  );
  const user = (id: unknown) => (id ? (userId.get(Number(id)) ?? null) : null);

  // ---------- Clientes já importados e veículos ----------
  const parties = await tx.party.findMany();
  const byKey = new Map(parties.map((p) => [partyKey(p), p]));
  const byDocument = new Map(parties.filter((p) => p.document).map((p) => [p.document!, p]));
  const partyId = new Map<number, string>();
  // Mesma ordem e regra de documento único da primeira carga: quem ficou com o CNPJ acha pelo CNPJ.
  const usedDocuments = new Set<string>();
  for (const c of [...operandClients].sort((a, b) => Number(a.isDeleted) - Number(b.isDeleted))) {
    const document = digits(c.nationalDocument);
    const unique = document && !usedDocuments.has(document) ? document : null;
    if (unique) usedDocuments.add(unique);
    const found = unique
      ? byDocument.get(unique)
      : byKey.get(partyKey({ name: c.name, legalName: c.officialName?.trim() || null, city: c.city?.trim() || null, active: c.isDeleted === '0' }));
    if (!found) throw new Error(`Cliente ${c.id} do Operand não encontrado no banco.`);
    partyId.set(Number(c.id), found.id);
  }
  const newParties: Prisma.PartyCreateManyInput[] = [];
  const vehicleFlag: string[] = [];
  const contacts: Prisma.ContactCreateManyInput[] = [];
  const contactId = new Map<number, string>();
  for (const v of [...operandVehicles].sort((a, b) => Number(a.isDeleted) - Number(b.isDeleted))) {
    const document = digits(v.nationalDocument);
    // Só junta quando é o mesmo cadastro no Operand (cliente que também é veículo); CNPJ repetido
    // costuma ser filial ou praça diferente, então vira outro cadastro sem documento.
    const existing = partyId.get(Number(v.id));
    if (existing) {
      partyId.set(Number(v.id), existing);
      vehicleFlag.push(existing);
      continue;
    }
    const id = randomUUID();
    partyId.set(Number(v.id), id);
    // CNPJ repetido entre veículos: o primeiro (ativo) fica com o documento.
    const unique = document && !byDocument.has(document) ? document : null;
    if (unique) byDocument.set(unique, { id } as never);
    newParties.push({
      id,
      personType: document?.length === 11 ? 'PF' : 'PJ',
      name: plain(v.name).trim() || 'Veículo',
      legalName: plain(v.officialName).trim() || null,
      document: unique,
      email: v.email?.trim() || null,
      phone1: v.phone?.trim() || null,
      zipCode: digits(v.zipCode),
      street: v.address?.trim() || null,
      number: v.addressNumber?.trim() || null,
      complement: v.addressComplement?.trim() || null,
      district: v.district?.trim() || null,
      city: v.city?.trim() || null,
      state: v.state?.trim() || null,
      country: v.country?.trim() || 'Brasil',
      isVehicle: true,
      isClient: v.isClient === '1',
      isSupplier: v.isSupplier === '1',
      isProvider: v.isProvider === '1',
      active: v.isDeleted === '0',
    });
    for (const contact of JSON.parse(v.contacts || '[]')) {
      if (!contact.sContact?.trim()) continue;
      const cid = randomUUID();
      contactId.set(Number(contact.iContact), cid);
      contacts.push({ id: cid, partyId: id, name: contact.sContact.trim(), email: contact.sEmail?.trim() || null, phone1: contact.sPhone?.trim() || null });
    }
  }
  await tx.party.createMany({ data: newParties });
  await tx.party.updateMany({ where: { id: { in: vehicleFlag } }, data: { isVehicle: true } });
  await tx.contact.createMany({ data: contacts });
  report['veículos novos'] = newParties.length;
  report['veículos que já eram cadastro'] = vehicleFlag.length;
  const party = (id: unknown, what: string) => {
    const found = partyId.get(Number(id));
    if (!found) throw new Error(`${what} ${id} do Operand sem cadastro.`);
    return found;
  };

  // ---------- Projetos fechados no Operand que têm mídia ----------
  const projectStatuses = await tx.projectStatus.findMany({ where: { docType: 'PROJECT' } });
  const statusName = new Map(operandStatuses.projeto.map((s) => [s.id, s.name]));
  for (const p of operandExtraProjects) {
    const members = new Set([p.requesterId, p.responsibleId, ...(p.involvedIds ?? [])].map(user).filter(Boolean));
    await tx.project.create({
      data: {
        number: p.id,
        title: plain(p.title).trim() || 'Projeto',
        clientId: party(p.personId, 'Cliente'),
        description: htmlToText(p.description),
        requesterId: user(p.requesterId),
        responsibleId: user(p.responsibleId),
        statusId: projectStatuses.find((s) => s.name === statusName.get(p.statusId))?.id ?? null,
        situation: p.situation === 'removed' ? 'CANCELED' : 'ARCHIVED',
        hidden: Boolean(p.isPrivate),
        budget: Number(p.budget) || 0,
        closedAt: date(p.concludedAt) ?? date(p.updatedAt),
        createdAt: date(p.createdAt) ?? new Date(),
        members: { create: [...members].map((id) => ({ userId: id! })) },
      },
    });
  }
  report['projetos fechados criados'] = operandExtraProjects.length;
  const projects = new Map((await tx.project.findMany({ select: { id: true, number: true, situation: true, closedAt: true } })).map((p) => [p.number, p]));

  // ---------- Catálogos: status, praças, métricas, redes e programas ----------
  const statuses = await tx.mediaStatus.findMany();
  const metrics = await tx.costMetric.findMany();
  const markets = new Map((await tx.market.findMany()).map((m) => [m.name.toLowerCase(), m.id]));
  const market = async (locality: any) => {
    const name = plain(locality?.sName).trim();
    if (!name) return null;
    let id = markets.get(name.toLowerCase());
    if (!id) {
      id = (await tx.market.create({ data: { name, abbreviation: plain(locality.sShortName).trim() || null, state: plain(locality.sState).trim().slice(0, 2) || null } })).id;
      markets.set(name.toLowerCase(), id);
    }
    return id;
  };
  const networks = new Map((await tx.network.findMany()).map((n) => [n.mnemonic, n.id]));
  const vehicleName = new Map(operandVehicles.map((v) => [Number(v.id), plain(v.name).trim()]));
  /** Rede da mídia: a do Operand; sem rede (rádio e TV local), uma por veículo. */
  const network = async (operandId: number, name: string, shortName: string, vehicleId: number, kind: 'TV' | 'RADIO') => {
    const key = operandId ? `N${operandId}` : `V${vehicleId}`;
    if (networks.has(key)) return networks.get(key)!;
    const label = operandId ? plain(name).trim() || `Rede ${operandId}` : vehicleName.get(vehicleId) || `Veículo ${vehicleId}`;
    let mnemonic = (operandId ? plain(shortName).trim() || label : label).toUpperCase().slice(0, 60);
    if ([...networks.keys()].includes(mnemonic)) mnemonic = `${mnemonic} (${key})`;
    const { id } = await tx.network.create({ data: { name: label.slice(0, 250), mnemonic, type: kind === 'RADIO' ? 'RADIO' : 'OPEN_TV' } });
    networks.set(key, id).set(mnemonic, id);
    return id;
  };
  const programs = new Map<string, string>();
  const program = async (networkId: string, raw: any, kind: 'TV' | 'RADIO') => {
    const name = plain(raw?.sName).trim() || 'Programa';
    const key = `${networkId}|${kind}|${name.toLowerCase()}`;
    if (!programs.has(key)) {
      const mnemonic = (plain(raw?.sShortName).trim() || name).toUpperCase().slice(0, 60);
      const taken = [...programs.keys()].filter((k) => k.startsWith(`${networkId}|`)).length;
      const { id } = await tx.program.create({
        data: {
          networkId,
          name,
          mnemonic: taken ? `${mnemonic} ${taken + 1}` : mnemonic,
          mediaType: kind,
          // shortcut: o Operand guarda os dias por linha, não por programa; todos os dias para o calendário aceitar as inserções.
          airingDays: [0, 1, 2, 3, 4, 5, 6],
          startTime: raw?.tmStartTime?.slice(0, 5) || null,
          endTime: raw?.tmEndTime?.slice(0, 5) || null,
        },
      });
      programs.set(key, id);
    }
    return programs.get(key)!;
  };

  // ---------- Mídias ----------
  const sequences = new Map<string, number>();
  let created = 0;
  for (const item of mediaList) {
    const detail = details.get(item.id);
    const model = detail?.model ?? {};
    const mediaType = TYPES[item.mediaType] ?? 'OTHER';
    const project = projects.get(item.projectId);
    if (!project) throw new Error(`Projeto ${item.projectId} da mídia ${item.id} não está no banco.`);
    let situation: 'OPEN' | 'DONE' | 'CANCELED' = SITUATION[item.situation as keyof typeof SITUATION] ?? 'OPEN';
    let closedAt: Date | null = situation === 'OPEN' ? null : (date(detail?.dtUpdated) ?? date(item.createdAt));
    // Projeto arquivado ou cancelado fecha as mídias, como no operador.
    if (situation === 'OPEN' && project.situation !== 'OPEN') {
      situation = project.situation === 'CANCELED' ? 'CANCELED' : 'DONE';
      closedAt = project.closedAt;
      bump('mídias fechadas pelo projeto');
    }
    const fin = model.financial ?? {};
    const bill = list(fin.docBilling)[0] ?? {};
    const billingType = BILLING[bill.iBillingTypeId] ?? null;
    const agreed = Number(fin.dcAgreedCommission ?? bill.dcAgreedCommission ?? 0);
    const terms = {
      commissionType: valueType(fin.eCommission),
      commissionValue: Number(fin.dcCommission ?? 0),
      // 0,000001 é o "sem negociação" do Operand.
      negotiatedCommission: agreed > 0.0001 && (!billingType || allowsNegotiatedCommission(billingType)) ? agreed : null,
      feeType: valueType(fin.eFeeType),
      feeValue: Number(fin.dcFeeValue ?? 0),
      generalDiscountType: valueType(bill.eDiscountType),
      generalDiscountValue: Number(bill.dcDiscountValue ?? 0),
    };
    const invoice = list(bill.jsonBills)[0];
    const installment = list(invoice?.arrInstallments)[0];
    const paymentCondition = invoice
      ? [invoice.ePaymentCondition === 'unique' ? 'À vista' : `${invoice.iNumberInstallments} parcelas`, installment?.sPaymentType].filter(Boolean).join(' – ')
      : null;

    const networkId =
      mediaType === 'TV' && Number(model.iEntVehicleNetworkId)
        ? await network(Number(model.iEntVehicleNetworkId), model.sNetworkName, model.sNetworkShortName, Number(item.vehicleId), 'TV')
        : null;

    const mediaId = randomUUID();
    const pieceId = new Map<number, string>();
    const pieces: Prisma.MediaPieceCreateManyInput[] = [];
    for (const piece of list(model.pieces).filter(active)) {
      const letter = String(piece.sPieceIndex || '').slice(0, 3);
      if (!letter || pieces.some((p) => p.letter === letter)) continue;
      const id = randomUUID();
      pieceId.set(Number(piece.iMediaPieceId), id);
      pieces.push({ id, mediaId, letter, title: plain(piece.sPieceTitle).trim() || letter });
    }

    const grids: Prisma.MediaGridCreateManyInput[] = [];
    const lines: Prisma.MediaLineCreateManyInput[] = [];
    const totals: ReturnType<typeof gridTotals>[] = [];
    const replica = new Map<string, string>();
    for (const [order, grid] of list(model.mediaGrids).filter(active).entries()) {
      const gridId = randomUUID();
      const group = String(grid.iMediaGridGroupId ?? '0');
      if (group !== '0' && !replica.has(group)) replica.set(group, randomUUID());
      grids.push({
        id: gridId,
        mediaId,
        marketId: await market(grid.arrLocality),
        periodStart: day(grid.jsonPeriod?.dtInitialPeriodDate),
        periodEnd: day(grid.jsonPeriod?.dtEndPeriodDate),
        order,
        replicaGroupId: replica.get(group) ?? null,
      });
      const values: LineValues[] = [];
      for (const [lineOrder, l] of list(grid.arrMediaGridPieces).filter(active).entries()) {
        const quantity = Number(l.dcPlacementQuantity || 0);
        if (!Number.isInteger(quantity)) bump('linhas com quantidade fracionada (arredondada)');
        const value: LineValues = {
          quantity: Math.round(quantity),
          unitValue: money(l.dcPlacementUnityValue),
          discountType: valueType(l.ePlacementDiscountType),
          discountValue: Number(l.dcPlacementDiscountValue || 0),
          isBonus: l.bPlacementBonus === '1',
        };
        let subtotal: number;
        try {
          subtotal = lineSubtotal(value);
        } catch (error) {
          if (!(error instanceof MediaMathError)) throw error;
          subtotal = money(l.dcPlacementTotalValue);
          bump('linhas com desconto maior que o valor (mantido o total do Operand)');
        }
        if (Math.abs(subtotal - money(l.dcPlacementTotalValue)) > 0.01) bump('linhas com total diferente do Operand');
        values.push(value);
        const period = Array.isArray(l.jsonPlacements) ? null : l.jsonPlacements;
        const daily = Array.isArray(l.jsonPlacements)
          ? Object.fromEntries(l.jsonPlacements.flatMap((d: object) => Object.entries(d)).map(([k, n]) => [k, Number(n)]).filter(([, n]) => (n as number) > 0))
          : null;
        const dailyDates = daily ? Object.keys(daily).sort() : [];
        const line: Prisma.MediaLineCreateManyInput = {
          gridId,
          pieceId: pieceId.get(Number(l.iMediaPieceId)) ?? null,
          startDate: day(period?.dtInitialPeriodDate) ?? day(dailyDates[0]),
          endDate: day(period?.dtEndPeriodDate) ?? day(dailyDates.at(-1)),
          insertions: value.quantity,
          unitValue: value.unitValue,
          discountType: value.discountType,
          discountValue: value.discountValue,
          subtotal,
          isBonus: value.isBonus,
          order: lineOrder,
        };
        if (mediaType === 'TV' || mediaType === 'RADIO') {
          const raw = mediaType === 'TV' ? l.arrTVProgram : l.arrRadioProgram;
          const programNetwork = Number(raw?.iEntVehicleNetworkId)
            ? await network(Number(raw.iEntVehicleNetworkId), '', '', Number(item.vehicleId), mediaType)
            : (networkId ?? (await network(0, '', '', Number(raw?.iVehicleId || item.vehicleId), mediaType)));
          line.programId = await program(programNetwork, raw, mediaType);
          line.format = plain((mediaType === 'TV' ? l.arrTVFormat : l.arrRadioFormat)?.sFormatName) || null;
          line.dailyInsertions = daily ?? {};
        } else if (mediaType === 'OOH') {
          line.product = plain(l.arrProduct?.sName) || null;
          // Bi-semana do Operand tem numeração própria (passa de 26): fica o período em datas, que ele também guarda.
          line.location = plain(l.arrPlace?.sPlaceName) || null;
        } else if (mediaType === 'INTERNET') {
          line.location = plain(l.sPlace) || null;
          line.format = plain(l.sFormat) || null;
          line.placementType = plain(l.sPlacementType) || null;
          const metric = plain(list(l.arrCostMetrics)[0]?.sName).toUpperCase();
          line.costMetricId = metrics.find((m) => m.name === metric)?.id ?? null;
        } else if (mediaType === 'NEWSPAPER') {
          line.section = plain(l.arrSection?.sSectionName) || null;
          line.position = plain(l.arrPosition?.sPositionName) || null;
          line.color = plain(l.arrColor?.sColor) || null;
          if (Number(l.dcWidth) && Number(l.dcHeight)) line.format = `${Number(l.dcWidth)} x ${Number(l.dcHeight)}`;
        } else if (mediaType === 'MAGAZINE') {
          line.product = plain(l.arrMagazine?.sName) || null;
          line.format = plain(l.arrMagazineFormat?.sFormatName) || null;
          line.position = plain(l.sPosition) || null;
          line.color = plain(l.arrColor?.sColor) || null;
        } else {
          line.location = plain(l.sPlace) || null;
          line.format = plain(l.sFormat) || null;
        }
        lines.push(line);
      }
      totals.push(gridTotals(values));
    }

    // Mesma conta do recalculate() do serviço de mídias.
    let grossTotal: number, bonusTotal: number, netValue: number;
    try {
      const t = mediaTotals(totals, terms);
      [grossTotal, bonusTotal, netValue] = [t.total, t.bonusTotal, t.net];
    } catch (error) {
      if (!(error instanceof MediaMathError)) throw error;
      [grossTotal, bonusTotal, netValue] = [totals.reduce((s, g) => s + g.total, 0), 0, 0];
      bump('mídias com comissão ou desconto inválidos (líquido zerado)');
    }
    if (detail && Math.abs(grossTotal - money(bill.dcTotalValue)) > 0.01) bump('mídias com total diferente do Operand');

    await tx.media.create({
      data: {
        id: mediaId,
        projectId: project.id,
        sequence: item.itemId,
        clientId: party(item.clientId, 'Cliente'),
        title: plain(item.title).trim() || 'Mídia',
        mediaType,
        vehicleId: item.vehicleId ? party(item.vehicleId, 'Veículo') : null,
        vehicleContactId: contactId.get(Number(detail?.iContactVehicleId)) ?? null,
        networkId,
        channel: plain(model.sChannel) || null,
        responsibleId: user(item.responsibleId),
        requesterId: user(item.requesterId),
        statusId: statuses.find((s) => s.name === item.statusName)?.id ?? null,
        situation,
        deadline: date(item.deadline),
        commissionType: terms.commissionType,
        commissionValue: terms.commissionValue,
        negotiatedCommission: terms.negotiatedCommission,
        feeType: terms.feeType,
        feeValue: terms.feeValue,
        discountType: terms.generalDiscountType,
        discountValue: terms.generalDiscountValue,
        grossTotal,
        bonusTotal,
        netValue,
        billingType,
        firstDueDate: day(installment?.dtDueDate),
        paymentCondition,
        vehicleNotes: htmlToText(model.sVehicleObservation),
        clientNotes: htmlToText(model.sClientObservation),
        closedAt,
        createdAt: date(item.createdAt) ?? new Date(),
        members: {
          create: [...new Set([item.requesterId, item.responsibleId, ...(item.involvedIds ?? [])].map(user).filter(Boolean))].map((id) => ({ userId: id! })),
        },
      },
    });
    await tx.mediaPiece.createMany({ data: pieces });
    await tx.mediaGrid.createMany({ data: grids });
    await tx.mediaLine.createMany({ data: lines });
    sequences.set(project.id, Math.max(sequences.get(project.id) ?? 0, item.itemId));
    bump(`mídias ${situation}`);
    bump('linhas', lines.length);
    if (++created % 500 === 0) console.log(`mídias: ${created}/${mediaList.length}`);
  }

  // Documentos novos do projeto continuam depois do maior número usado (jobs e mídias dividem a sequência).
  for (const [id, sequence] of sequences) {
    await tx.project.updateMany({ where: { id, lastDocumentSequence: { lt: sequence } }, data: { lastDocumentSequence: sequence } });
  }
  report['redes criadas'] = new Set(networks.values()).size;
  report['programas criados'] = programs.size;
  report['praças'] = markets.size;
  console.table(report);
  if (DRY) throw new Error('DRY_RUN');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }),
});
try {
  await prisma.$transaction(run, { timeout: 60 * 60_000, maxWait: 60_000 });
  console.log('Carga das mídias concluída.');
} catch (error) {
  if ((error as Error).message !== 'DRY_RUN') throw error;
  console.log('Simulação concluída: nada foi gravado.');
} finally {
  await prisma.$disconnect();
}
