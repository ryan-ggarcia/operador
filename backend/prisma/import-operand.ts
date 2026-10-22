// Carga única dos dados exportados do Operand (pasta dados-operand/, fora do Git):
// usuários, clientes com contatos, projetos e jobs ativos com as tarefas.
// Tudo numa transação: ou entra tudo, ou nada. Recusa rodar se já houver projetos.
//
//   npx tsx prisma/import-operand.ts --dry-run   (valida no banco e desfaz)
//   npx tsx prisma/import-operand.ts
import 'dotenv/config';
import assert from 'node:assert';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { ScryptPasswordHasher } from '../src/modules/auth/password/scrypt-password-hasher.js';

const DIR = new URL('../../dados-operand/', import.meta.url);
const DRY = process.argv.includes('--dry-run');
// Projetos sem nenhuma alteração (projeto, jobs ou tarefas) desde esta data entram arquivados.
const STALE_BEFORE = '2025-10-22';
// Perfil do Operand (id) → perfil do operador; inferido pelos níveis de cada um. 1 = Conversa (fora da v1).
const PROFILES: Record<number, string> = { 2: 'Criativo', 4: 'Total', 5: 'Criativo', 7: 'Administrador', 8: 'Total' };

const read = (name: string) => JSON.parse(readFileSync(new URL(name, DIR), 'utf8'));
const operandUsers: any[] = read('usuarios.json');
const operandClients: any[] = read('clientes.json');
const operandProjects: any[] = read('projetos.json');
const operandJobs: any[] = Object.values(read('jobs.json'));
const operandStatuses: { projeto: any[] } = read('status.json');

/** "2026-10-21 23:59:59" no fuso da agência; "0000-00-00 ..." = vazio. */
// shortcut: fixo em -03:00, datas antigas do horário de verão (até 2019) ficam 1 h deslocadas; irrelevante para prazos.
function date(value: string | null | undefined): Date | null {
  if (!value || value.startsWith('0000')) return null;
  return new Date(value.replace(' ', 'T') + '-03:00');
}

/** Briefing do Operand é HTML; o operador guarda texto puro (e nunca renderiza HTML). */
function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
}
assert.equal(
  htmlToText('<p>Oi&nbsp;<b>A&amp;B</b></p><ul><li>um</li></ul><img src="data:image/png;base64,AAA">x &#233;'),
  'Oi A&B\n\n- um\nx é',
);
assert.equal(date('0000-00-00 00:00:00'), null);
assert.equal(date('2026-10-21 23:59:59')!.toISOString(), '2026-10-22T02:59:59.000Z');

const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '') || null;
const tasksOf = (job: any): any[] => (Array.isArray(job.tarefas) ? job.tarefas : []);

async function run(tx: Prisma.TransactionClient) {
  if (await tx.project.count()) throw new Error('Já existem projetos no banco: a carga só roda uma vez.');
  const now = new Date();

  // ---------- Usuários ----------
  const profiles = new Map((await tx.accessProfile.findMany()).map((p) => [p.name, p.id]));
  const existingUsers = new Map((await tx.userAccount.findMany()).map((u) => [u.email, u.id]));
  const hasher = new ScryptPasswordHasher();
  const userId = new Map<number, string>();
  const newUsers: Prisma.UserAccountCreateManyInput[] = [];
  for (const u of operandUsers) {
    const email = u.email.trim().toLowerCase();
    const id = existingUsers.get(email) ?? randomUUID();
    userId.set(u.id, id);
    if (existingUsers.has(email)) continue;
    newUsers.push({
      id,
      email,
      name: u.name.trim(),
      color: u.color || null,
      // Ninguém sabe a senha: o administrador define uma provisória em Configurações › Usuários.
      passwordHash: await hasher.hash(randomBytes(32).toString('base64url')),
      mustChangePassword: true,
      accessProfileId: profiles.get(PROFILES[u.permissionProfile]) ?? null,
      active: u.situation === 'active',
    });
  }
  await tx.userAccount.createMany({ data: newUsers });
  const user = (id: unknown) => (id ? (userId.get(Number(id)) ?? null) : null);

  // ---------- Clientes ----------
  const existingParties = await tx.party.findMany();
  const clientId = new Map<number, string>();
  const usedDocuments = new Set(existingParties.map((p) => p.document).filter(Boolean));
  const parties: Prisma.PartyCreateManyInput[] = [];
  const contacts: Prisma.ContactCreateManyInput[] = [];
  // Ativos primeiro: com CNPJ repetido, o ativo fica com o documento.
  for (const c of [...operandClients].sort((a, b) => Number(a.isDeleted) - Number(b.isDeleted))) {
    const document = digits(c.nationalDocument);
    const name = c.name.trim();
    const found = existingParties.find(
      (p) => (document && p.document === document) || p.name.toLowerCase() === name.toLowerCase(),
    );
    if (found) {
      clientId.set(Number(c.id), found.id);
      if (!found.isClient) await tx.party.update({ where: { id: found.id }, data: { isClient: true } });
      continue;
    }
    const id = randomUUID();
    clientId.set(Number(c.id), id);
    const unique = document && !usedDocuments.has(document) ? document : null;
    if (unique) usedDocuments.add(unique);
    parties.push({
      id,
      personType: document?.length === 11 ? 'PF' : 'PJ',
      name,
      legalName: c.officialName?.trim() || null,
      document: unique,
      email: c.email?.trim() || null,
      phone1: c.phone?.trim() || null,
      zipCode: digits(c.zipCode),
      street: c.address?.trim() || null,
      number: c.addressNumber?.trim() || null,
      complement: c.addressComplement?.trim() || null,
      district: c.district?.trim() || null,
      city: c.city?.trim() || null,
      state: c.state?.trim() || null,
      country: c.country?.trim() || 'Brasil',
      isClient: true,
      isSupplier: c.isSupplier === '1',
      isProvider: c.isProvider === '1',
      isVehicle: c.isVehicle === '1',
      active: c.isDeleted === '0',
    });
    for (const contact of JSON.parse(c.contacts || '[]')) {
      if (!contact.sContact?.trim()) continue;
      contacts.push({
        partyId: id,
        name: contact.sContact.trim(),
        email: contact.sEmail?.trim() || null,
        phone1: contact.sPhone?.trim() || null,
      });
    }
  }
  await tx.party.createMany({ data: parties });
  await tx.contact.createMany({ data: contacts });
  const client = (id: unknown) => {
    const found = clientId.get(Number(id));
    if (!found) throw new Error(`Cliente ${id} do Operand sem cadastro.`);
    return found;
  };

  // ---------- Status ----------
  const statuses = await tx.projectStatus.findMany();
  const statusByName = (docType: 'PROJECT' | 'JOB', name: string | null | undefined) =>
    statuses.find((s) => s.docType === docType && s.name === name)?.id ?? null;
  const projectStatusName = new Map(operandStatuses.projeto.map((s) => [s.id, s.name]));

  // ---------- Projetos ----------
  const lastActivity = new Map<number, string>(operandProjects.map((p) => [p.id, p.updatedAt]));
  const maxSequence = new Map<number, number>();
  for (const job of operandJobs) {
    for (const at of [job.updatedAt, ...tasksOf(job).map((t) => t.updatedAt)]) {
      if (at > lastActivity.get(job.projectId)!) lastActivity.set(job.projectId, at);
    }
    maxSequence.set(job.projectId, Math.max(maxSequence.get(job.projectId) ?? 0, job.itemId));
  }
  const projectId = new Map<number, string>();
  const archivedAt = new Map<number, Date>();
  const projects: Prisma.ProjectCreateManyInput[] = [];
  const projectMembers: Prisma.ProjectMemberCreateManyInput[] = [];
  for (const p of operandProjects) {
    const id = randomUUID();
    projectId.set(p.id, id);
    const stale = lastActivity.get(p.id)! < STALE_BEFORE;
    if (stale) archivedAt.set(p.id, date(lastActivity.get(p.id))!);
    projects.push({
      id,
      // Mesmo número do Operand, para a equipe reconhecer os documentos.
      number: p.id,
      title: p.title.trim(),
      clientId: client(p.personId),
      description: htmlToText(p.description),
      requesterId: user(p.requesterId),
      responsibleId: user(p.responsibleId),
      statusId: statusByName('PROJECT', projectStatusName.get(p.statusId)),
      situation: stale ? 'ARCHIVED' : 'OPEN',
      hidden: Boolean(p.isPrivate),
      desiredDeadline: date(p.providedAt),
      budget: Number(p.budget) || 0,
      // shortcut: só os jobs ativos vieram; números de jobs fechados e mídias do Operand podem se repetir em documentos novos.
      lastDocumentSequence: maxSequence.get(p.id) ?? 0,
      closedAt: archivedAt.get(p.id) ?? null,
      createdAt: date(p.createdAt) ?? now,
    });
    const members = new Set([p.requesterId, p.responsibleId, ...(p.involvedIds ?? [])].map(user).filter(Boolean));
    for (const member of members) projectMembers.push({ projectId: id, userId: member! });
  }
  for (let i = 0; i < projects.length; i += 1000) {
    await tx.project.createMany({ data: projects.slice(i, i + 1000) });
  }
  await tx.projectMember.createMany({ data: projectMembers });
  // O autoincremento continua depois do maior número do Operand.
  await tx.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('projects.project', 'number'), (SELECT max(number) FROM projects.project))`,
  );

  // ---------- Jobs e tarefas ----------
  const jobs: Prisma.JobCreateManyInput[] = [];
  const jobMembers: Prisma.JobMemberCreateManyInput[] = [];
  const tasks: Prisma.TaskCreateManyInput[] = [];
  for (const j of operandJobs) {
    const id = randomUUID();
    // Projeto arquivado conclui os jobs e as tarefas abertas, como no "Arquivar" do operador.
    const closedAt = archivedAt.get(j.projectId) ?? null;
    const deadline = date(j.deadline);
    jobs.push({
      id,
      projectId: projectId.get(j.projectId)!,
      sequence: j.itemId,
      title: j.title.trim().slice(0, 250),
      clientId: client(j.clientId),
      responsibleId: user(j.responsibleId),
      requesterId: user(j.requesterId),
      statusId: statusByName('JOB', j.statusName),
      situation: closedAt ? 'DONE' : 'OPEN',
      startAt: date(j.initialDate),
      deadline,
      deadlineHasTime: Boolean(deadline) && !j.deadline.endsWith('23:59:59'),
      // Tempo estimado fica de fora: veio zerado em todos os jobs exportados.
      briefing: htmlToText(j.description),
      closedAt,
      createdAt: date(j.createdAt) ?? now,
    });
    const members = new Set([j.requesterId, j.responsibleId, ...(j.jsonInvolvedIds ?? [])].map(user).filter(Boolean));
    for (const member of members) jobMembers.push({ jobId: id, userId: member! });
    for (const t of tasksOf(j)) {
      // Operand: completed = 100 → concluída; isDeleted = "2" → cancelada.
      const situation = t.isDeleted === '2' ? 'CANCELED' : t.completed === 100 || closedAt ? 'DONE' : 'OPEN';
      tasks.push({
        jobId: id,
        title: t.subtaskTitle?.trim() || 'Tarefa',
        responsibleId: user(t.responsibleId),
        statusId: statusByName('JOB', t.statusName),
        order: t.orderId ?? 0,
        startAt: date(t.initialDate),
        deadline: date(t.deadline),
        situation,
        completedAt: situation === 'DONE' ? (date(t.finishedAt) ?? closedAt ?? date(t.updatedAt)) : null,
        createdAt: date(t.createdAt) ?? now,
      });
    }
  }
  for (let i = 0; i < jobs.length; i += 500) await tx.job.createMany({ data: jobs.slice(i, i + 500) });
  for (let i = 0; i < jobMembers.length; i += 5000) {
    await tx.jobMember.createMany({ data: jobMembers.slice(i, i + 5000) });
  }
  for (let i = 0; i < tasks.length; i += 5000) await tx.task.createMany({ data: tasks.slice(i, i + 5000) });

  const count = (items: { situation?: unknown }[], situation: string) =>
    items.filter((item) => item.situation === situation).length;
  console.table({
    'usuários novos': newUsers.length,
    'usuários já existentes': operandUsers.length - newUsers.length,
    'clientes novos': parties.length,
    contatos: contacts.length,
    'projetos abertos': count(projects, 'OPEN'),
    'projetos arquivados': count(projects, 'ARCHIVED'),
    'jobs abertos': count(jobs, 'OPEN'),
    'jobs concluídos (projeto arquivado)': count(jobs, 'DONE'),
    tarefas: tasks.length,
    'jobs sem status no operador': jobs.filter((j) => !j.statusId).length,
  });
  if (DRY) throw new Error('DRY_RUN');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }),
});
try {
  await prisma.$transaction(run, { timeout: 15 * 60_000, maxWait: 60_000 });
  console.log('Carga concluída.');
} catch (error) {
  if ((error as Error).message !== 'DRY_RUN') throw error;
  console.log('Simulação concluída: nada foi gravado.');
} finally {
  await prisma.$disconnect();
}
