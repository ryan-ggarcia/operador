// Dados iniciais do operador (docs/modelo-de-dados.md, seção 6). Pode rodar
// mais de uma vez: só cria o que ainda não existe.
//
//   npx prisma db seed
//
// O dono da conta vem de OWNER_EMAIL, OWNER_NAME e OWNER_PASSWORD (senha
// provisória; o sistema pede a troca no primeiro acesso).
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { ScryptPasswordHasher } from '../src/modules/auth/password/scrypt-password-hasher.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Levels = Partial<
  Record<
    | 'projects' | 'jobs' | 'medias' | 'productions' | 'financial'
    | 'clients' | 'suppliers' | 'providers' | 'vehicles' | 'employees',
    number
  >
>;

const FINANCE_FLAGS = { financialRevenues: true, financialExpenses: true, financialTransfers: true };
const docs = (level: number) => ({ jobs: level, medias: level, productions: level });

/** Perfis prontos do Operand (docs/operand/configuracoes.md, 1.4). */
const PROFILES: { name: string; modules: Levels; flags: Record<string, unknown> }[] = [
  {
    name: 'Atendimento',
    modules: { projects: 6, ...docs(3), financial: 1, clients: 6, suppliers: 6, vehicles: 6 },
    flags: { projectBudget: 'edit', ...FINANCE_FLAGS },
  },
  { name: 'Criativo', modules: { ...docs(3) }, flags: {} },
  {
    name: 'Tráfego',
    modules: { projects: 6, ...docs(6), clients: 6, suppliers: 2, vehicles: 2 },
    flags: { projectBudget: 'edit' },
  },
  {
    name: 'Mídia',
    modules: { ...docs(3), financial: 1, clients: 6, vehicles: 6 },
    flags: { ...FINANCE_FLAGS },
  },
  {
    name: 'Produtor',
    modules: { ...docs(3), financial: 1, clients: 6, suppliers: 6 },
    flags: { ...FINANCE_FLAGS },
  },
  {
    name: 'Financeiro',
    modules: { ...docs(2), financial: 6, clients: 6, suppliers: 6, vehicles: 6, providers: 6, employees: 6 },
    flags: { ...FINANCE_FLAGS },
  },
  {
    name: 'Administrador',
    modules: {
      projects: 7, ...docs(7), financial: 7, clients: 7, suppliers: 7,
      vehicles: 7, providers: 7, employees: 7,
    },
    flags: { administrator: true, hiddenProjects: true, projectBudget: 'edit', ...FINANCE_FLAGS },
  },
  {
    name: 'Total',
    modules: {
      projects: 6, ...docs(6), financial: 6, clients: 6, suppliers: 6,
      vehicles: 6, providers: 6, employees: 6,
    },
    flags: { projectBudget: 'edit', ...FINANCE_FLAGS },
  },
];

const PROJECT_STATUSES = [
  { name: 'Planejar', color: '#64748b' },
  { name: 'Executar', color: '#2563eb' },
  { name: 'Aprovar', color: '#d97706' },
  { name: 'Finalizar', color: '#7c3aed' },
  { name: 'Entregue', color: '#16a34a' },
];

/** Status de job da conta (docs/operand/jobs.md, 2.7). */
const JOB_STATUSES = [
  { name: 'Atendimento', color: '#0ea5e9' },
  { name: 'Planejamento', color: '#6366f1' },
  { name: 'Redação', color: '#8b5cf6' },
  { name: 'Criação', color: '#ec4899' },
  { name: 'Aprovação Interna', color: '#f59e0b' },
  { name: 'Aprovação Cliente', color: '#f97316', ignoresDelay: true },
  { name: 'Programação', color: '#14b8a6' },
  { name: 'Mídia', color: '#06b6d4' },
  { name: 'T.I', color: '#475569' },
  { name: 'Entregue', color: '#16a34a', ignoresDelay: true },
  { name: 'Finalização', color: '#a3a3a3', active: false },
  { name: 'Templates', color: '#a3a3a3', active: false },
];

const MEDIA_STATUSES = [
  { name: 'Em aberto', color: '#64748b' },
  { name: 'Aprovação Interna', color: '#f59e0b' },
  { name: 'Aprovação Cliente', color: '#f97316', ignoresDelay: true },
  { name: 'Aprovado/Enviar PI', color: '#16a34a' },
  { name: 'Aguardando NF', color: '#0ea5e9', ignoresDelay: true },
  { name: 'Reprovado', color: '#dc2626' },
];

const PRODUCTION_STATUSES = [
  { name: 'Em aberto', color: '#64748b' },
  { name: 'Aprovação Interna', color: '#f59e0b' },
  { name: 'Aprovação Cliente', color: '#f97316', ignoresDelay: true },
  { name: 'Aprovado/Enviar PP', color: '#16a34a' },
  { name: 'Aguardando Entrega', color: '#0ea5e9', ignoresDelay: true },
  { name: 'Reprovado', color: '#dc2626' },
];

const PAYMENT_METHODS = [
  'Boleto', 'Cartão', 'Cheque', 'Débito automático', 'Depósito', 'Dinheiro', 'Pix', 'Transferência',
];

const CATEGORIES: { name: string; kind: 'REVENUE' | 'EXPENSE' }[] = [
  { name: 'Serviços prestados', kind: 'REVENUE' },
  { name: 'Comissão de mídia', kind: 'REVENUE' },
  { name: 'Comissão de produção', kind: 'REVENUE' },
  { name: 'Fornecedores', kind: 'EXPENSE' },
  { name: 'Veículos de mídia', kind: 'EXPENSE' },
  { name: 'Impostos', kind: 'EXPENSE' },
  { name: 'Despesas administrativas', kind: 'EXPENSE' },
];

/** Jornada padrão: 42h30 por semana, de segunda a sexta, meta de 8h30 por dia. */
const DEFAULT_SCHEDULE_PERIODS = Object.fromEntries(
  [1, 2, 3, 4, 5].map((weekday) => [
    weekday,
    [
      { start: '08:30', end: '12:00' },
      { start: '13:00', end: '18:00' },
    ],
  ]),
);

async function seedProfiles() {
  for (const profile of PROFILES) {
    await prisma.accessProfile.upsert({
      where: { name: profile.name },
      update: {},
      create: {
        name: profile.name,
        system: true,
        permissions: { modules: profile.modules, flags: profile.flags } as Prisma.InputJsonValue,
      },
    });
  }
}

async function seedOrdered<T extends { name: string; color: string; ignoresDelay?: boolean; active?: boolean }>(
  existing: () => Promise<number>,
  create: (data: T & { order: number }) => Promise<unknown>,
  items: T[],
) {
  if ((await existing()) > 0) return;
  for (const [order, item] of items.entries()) await create({ ...item, order });
}

async function seedStatuses() {
  await seedOrdered(
    () => prisma.projectStatus.count({ where: { docType: 'PROJECT' } }),
    (data) => prisma.projectStatus.create({ data: { ...data, docType: 'PROJECT' } }),
    PROJECT_STATUSES,
  );
  await seedOrdered(
    () => prisma.projectStatus.count({ where: { docType: 'JOB' } }),
    (data) => prisma.projectStatus.create({ data: { ...data, docType: 'JOB' } }),
    JOB_STATUSES,
  );
  await seedOrdered(
    () => prisma.mediaStatus.count(),
    (data) => prisma.mediaStatus.create({ data }),
    MEDIA_STATUSES,
  );
  await seedOrdered(
    () => prisma.productionStatus.count(),
    (data) => prisma.productionStatus.create({ data }),
    PRODUCTION_STATUSES,
  );
  for (const status of [
    { name: 'Em aberto', color: '#64748b' },
    { name: 'Enviado', color: '#2563eb' },
    { name: 'Agendado', color: '#d97706' },
  ]) {
    await prisma.financeStatus.upsert({
      where: { name: status.name },
      update: {},
      create: { ...status, system: true },
    });
  }
}

async function seedFinance() {
  for (const name of PAYMENT_METHODS) {
    await prisma.paymentMethod.upsert({
      where: { name },
      update: {},
      create: { name, isDefault: name === 'Pix' },
    });
  }
  if ((await prisma.category.count()) === 0) {
    await prisma.category.createMany({ data: CATEGORIES });
  }
  if ((await prisma.account.count()) === 0) {
    await prisma.account.create({ data: { name: 'Conta principal', isDefault: true } });
  }
}

async function seedSupport() {
  if ((await prisma.workSchedule.count({ where: { isDefault: true } })) === 0) {
    await prisma.workSchedule.create({
      data: {
        title: 'Jornada padrão',
        isDefault: true,
        productiveGoalMinutesPerDay: 510,
        periods: DEFAULT_SCHEDULE_PERIODS,
      },
    });
  }
  if ((await prisma.tax.count()) === 0) {
    await prisma.tax.create({ data: { title: 'Sem encargo', percent: 0, isDefault: true } });
  }
  for (const name of ['CPM', 'CPC', 'CPV', 'CPA', 'CPL']) {
    await prisma.costMetric.upsert({ where: { name }, update: {}, create: { name } });
  }
}

async function seedOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    console.log('OWNER_EMAIL/OWNER_PASSWORD não definidos: dono da conta não criado.');
    return;
  }
  if (await prisma.userAccount.findUnique({ where: { email } })) return;
  if (password.length < 8) throw new Error('OWNER_PASSWORD precisa ter pelo menos 8 caracteres.');
  const profile = await prisma.accessProfile.findUniqueOrThrow({ where: { name: 'Administrador' } });
  await prisma.userAccount.create({
    data: {
      email,
      name: process.env.OWNER_NAME?.trim() || 'Administrador',
      passwordHash: await new ScryptPasswordHasher().hash(password),
      accessProfileId: profile.id,
      isOwner: true,
      mustChangePassword: true,
    },
  });
  console.log(`Dono da conta criado: ${email} (troca de senha no primeiro acesso).`);
}

async function main() {
  await seedProfiles();
  await seedStatuses();
  await seedFinance();
  await seedSupport();
  await seedOwner();
  console.log('Dados iniciais conferidos.');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
