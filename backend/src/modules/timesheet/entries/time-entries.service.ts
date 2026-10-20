import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { localDate, zonedToUtc } from '../../../shared/time/timezone.js';
import type { Page } from '../../../shared/validation/pagination.js';
import { AUTH_FACADE, type AuthFacade, type UserPermissions } from '../../auth/public/index.js';
import { CRM_FACADE, type CrmFacade } from '../../crm/public/index.js';
import {
  PROJECTS_FACADE,
  type DocumentRef,
  type ProjectsFacade,
} from '../../projects/public/index.js';
import { SETTINGS_FACADE, type SettingsFacade } from '../../settings/public/index.js';
import {
  becomesManual,
  canManageEntry,
  canManageOthers,
  canSeeOthers,
  canStopOthers,
  elapsedMinutes,
  manualEntryError,
} from '../domain/time-rules.js';
import type { TimesheetDocType } from '../public/timesheet.facade.js';
import {
  RunningTimerExistsError,
  TIME_ENTRY_REPOSITORY,
  type DocRef,
  type EntryDocType,
  type EntryKind,
  type EntrySource,
  type EntrySituation,
  type TimeEntryChanges,
  type TimeEntryRecord,
  type TimeEntryRepository,
} from '../repositories/time-entry.repository.js';

const TO_ENTRY: Record<TimesheetDocType, EntryDocType> = { job: 'JOB', task: 'TASK', project: 'PROJECT' };
const FROM_ENTRY: Partial<Record<EntryDocType, TimesheetDocType>> = { JOB: 'job', TASK: 'task', PROJECT: 'project' };

export interface EntryView {
  id: string;
  user: { id: string; name: string; color: string | null } | null;
  doc: {
    docType: TimesheetDocType | null;
    id: string;
    jobId: string | null;
    number: string | null;
    title: string | null;
    parentTitle: string | null;
  };
  client: { id: string; name: string } | null;
  projectId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  /** Para o cronômetro rodando, o tempo até agora. */
  minutes: number;
  source: EntrySource;
  kind: EntryKind;
  description: string | null;
  situation: EntrySituation;
  can: { edit: boolean };
}

export interface EntryListQuery {
  mine?: boolean;
  userId?: string;
  /** AAAA-MM-DD, no fuso da agência. */
  from?: string;
  to?: string;
  docType?: TimesheetDocType;
  docId?: string;
  clientId?: string;
  projectId?: string;
  situation?: EntrySituation;
  source?: EntrySource;
  limit: number;
  offset: number;
}

export interface ManualEntryInput {
  docType: TimesheetDocType;
  docId: string;
  /** AAAA-MM-DD */
  date: string;
  minutes: number;
  kind?: EntryKind;
  description?: string | null;
  /** Lançar para outra pessoa (nível Total em jobs). */
  userId?: string;
}

export interface EntryChangesInput {
  description?: string | null;
  kind?: EntryKind;
  minutes?: number;
  date?: string;
}

export interface DocumentSummary {
  estimatedMinutes: number | null;
  realizedMinutes: number;
  /** Estimado − realizado (nulo sem estimativa). */
  balanceMinutes: number | null;
  runningUserIds: string[];
  entries: EntryView[];
}

/** Cronômetro, apontamentos manuais e pautas de horas. */
@Injectable()
export class TimeEntriesService {
  constructor(
    @Inject(TIME_ENTRY_REPOSITORY) private readonly entries: TimeEntryRepository,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
    @Inject(AUTH_FACADE) private readonly auth: AuthFacade,
    @Inject(CRM_FACADE) private readonly crm: CrmFacade,
    @Inject(SETTINGS_FACADE) private readonly settings: SettingsFacade,
  ) {}

  async current(userId: string): Promise<EntryView | null> {
    const running = await this.entries.findRunningByUser(userId);
    if (!running) return null;
    const [view] = await this.toViews([running], userId, null);
    return view;
  }

  /** Inicia o cronômetro num documento aberto. Um por usuário. */
  async start(
    userId: string,
    access: UserPermissions,
    input: { docType: TimesheetDocType; docId: string; description?: string | null },
  ): Promise<EntryView> {
    const doc = await this.requireDocument(userId, access, input.docType, input.docId);
    if (!doc.open) throw new BadRequestException('O documento está fechado: não dá para apontar horas.');
    const running = await this.entries.findRunningByUser(userId);
    if (running) throw await this.alreadyRunning(running);
    try {
      const entry = await this.entries.create(
        {
          userId,
          docType: TO_ENTRY[input.docType],
          docId: input.docId,
          projectId: doc.projectId,
          clientId: doc.clientId,
          startedAt: new Date(),
          endedAt: null,
          minutes: 0,
          source: 'TIMER',
          kind: 'NORMAL',
          description: input.description?.trim() || null,
          situation: 'RUNNING',
          hourlyCost: await this.auth.getHourlyRate(userId),
        },
        userId,
      );
      const [view] = await this.toViews([entry], userId, access);
      return view;
    } catch (error) {
      if (error instanceof RunningTimerExistsError) {
        const current = await this.entries.findRunningByUser(userId);
        throw current ? await this.alreadyRunning(current) : new ConflictException('Você já tem um cronômetro em andamento.');
      }
      throw error;
    }
  }

  /**
   * Para o cronômetro. Sem id, para o do próprio usuário; com id de outra
   * pessoa, exige leitura total em jobs (gestor).
   */
  async stop(
    userId: string,
    access: UserPermissions,
    input: { entryId?: string; description?: string | null; kind?: EntryKind },
  ): Promise<EntryView> {
    const entry = input.entryId
      ? await this.entries.findById(input.entryId)
      : await this.entries.findRunningByUser(userId);
    if (!entry || entry.situation !== 'RUNNING') {
      throw new NotFoundException('Nenhum cronômetro em andamento.');
    }
    if (entry.userId !== userId && !canStopOthers(access)) {
      throw new ForbiddenException('Sem permissão para parar o cronômetro de outra pessoa.');
    }
    const endedAt = new Date();
    const stopped = await this.entries.update(
      entry.id,
      {
        endedAt,
        minutes: elapsedMinutes(entry.startedAt, endedAt),
        situation: 'DONE',
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        kind: input.kind,
      },
      userId,
    );
    const [view] = await this.toViews([stopped], userId, access);
    return view;
  }

  /** Apontamento manual: sem data futura; para outra pessoa, nível Total. */
  async createManual(userId: string, access: UserPermissions, input: ManualEntryInput): Promise<EntryView> {
    const owner = input.userId ?? userId;
    if (owner !== userId && !canManageOthers(access)) {
      throw new ForbiddenException('Sem permissão para apontar horas de outra pessoa.');
    }
    const doc = await this.requireDocument(userId, access, input.docType, input.docId);
    if (doc.situation === 'CANCELED') throw new BadRequestException('O documento está cancelado.');
    const { startedAt, endedAt } = await this.manualTimes(input.date, input.minutes);
    const entry = await this.entries.create(
      {
        userId: owner,
        docType: TO_ENTRY[input.docType],
        docId: input.docId,
        projectId: doc.projectId,
        clientId: doc.clientId,
        startedAt,
        endedAt,
        minutes: input.minutes,
        source: 'MANUAL',
        kind: input.kind ?? 'NORMAL',
        description: input.description?.trim() || null,
        situation: 'DONE',
        hourlyCost: await this.auth.getHourlyRate(owner),
      },
      userId,
    );
    const [view] = await this.toViews([entry], userId, access);
    return view;
  }

  /** Editar o tempo ou a data converte o apontamento em manual. */
  async update(userId: string, access: UserPermissions, id: string, input: EntryChangesInput): Promise<EntryView> {
    const entry = await this.requireManageable(userId, access, id);
    const changes: TimeEntryChanges = {
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      kind: input.kind,
    };
    if (becomesManual(input)) {
      if (entry.situation === 'RUNNING') {
        throw new BadRequestException('Pare o cronômetro antes de mudar o tempo ou a data.');
      }
      const date = input.date ?? (await this.localDay(entry.startedAt));
      const minutes = input.minutes ?? entry.minutes;
      Object.assign(changes, await this.manualTimes(date, minutes), { minutes, source: 'MANUAL' });
    }
    const updated = await this.entries.update(id, changes, userId);
    const [view] = await this.toViews([updated], userId, access);
    return view;
  }

  async remove(userId: string, access: UserPermissions, id: string): Promise<void> {
    await this.requireManageable(userId, access, id);
    await this.entries.delete(id);
  }

  /** Pauta de apontamentos. Sem leitura total em jobs, só os próprios. */
  async list(
    userId: string,
    access: UserPermissions,
    query: EntryListQuery,
  ): Promise<Page<EntryView> & { totalMinutes: number }> {
    let userIds: string[] | undefined;
    if (query.mine || !canSeeOthers(access)) userIds = [userId];
    else if (query.userId) userIds = [query.userId];
    const { timezone } = await this.settings.getAgency();
    const page = await this.entries.list({
      userIds,
      from: query.from ? zonedToUtc(parseDate(query.from), timezone) : undefined,
      to: query.to ? zonedToUtc({ ...parseDate(query.to), day: parseDate(query.to).day + 1 }, timezone) : undefined,
      docs: query.docType && query.docId ? await this.docsWithTasks(query.docType, query.docId) : undefined,
      clientId: query.clientId,
      projectId: query.projectId,
      situation: query.situation,
      source: query.source,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      total: page.total,
      totalMinutes: page.totalMinutes,
      items: await this.toViews(page.items, userId, access),
    };
  }

  /** Estimado × realizado do documento (job soma as tarefas) e os apontamentos. */
  async documentSummary(
    userId: string,
    access: UserPermissions,
    docType: TimesheetDocType,
    docId: string,
  ): Promise<DocumentSummary> {
    await this.requireDocument(userId, access, docType, docId);
    const docs = await this.docsWithTasks(docType, docId);
    const [sums, running, page, estimated] = await Promise.all([
      this.entries.sumMinutes(docs),
      this.entries.findRunning({ docs }),
      this.entries.list({
        docs,
        userIds: canSeeOthers(access) ? undefined : [userId],
        limit: 200,
        offset: 0,
      }),
      docType === 'job' ? this.projects.getJobs([docId]).then(([job]) => job?.estimatedMinutes ?? null) : null,
    ]);
    const realized = sums.reduce((total, sum) => total + sum.minutes, 0);
    return {
      estimatedMinutes: estimated,
      realizedMinutes: realized,
      balanceMinutes: estimated == null ? null : estimated - realized,
      runningUserIds: running.map((entry) => entry.userId),
      entries: await this.toViews(page.items, userId, access),
    };
  }

  /** Cronômetros em andamento de todos (pauta Jobs › Timesheet). */
  async running(userId: string, access: UserPermissions): Promise<EntryView[]> {
    if (!canSeeOthers(access)) throw new ForbiddenException('Sem permissão para ver os cronômetros da equipe.');
    return this.toViews(await this.entries.findRunning({}), userId, access);
  }

  private async requireDocument(
    userId: string,
    access: UserPermissions,
    docType: TimesheetDocType,
    docId: string,
  ): Promise<DocumentRef> {
    const doc = await this.projects.getDocumentForUser(docType, docId, userId, access);
    if (!doc) throw new NotFoundException('Documento não encontrado.');
    return doc;
  }

  private async requireManageable(userId: string, access: UserPermissions, id: string): Promise<TimeEntryRecord> {
    const entry = await this.entries.findById(id);
    if (!entry || (entry.userId !== userId && !canSeeOthers(access))) {
      throw new NotFoundException('Apontamento não encontrado.');
    }
    if (!canManageEntry(userId, entry.userId, access)) {
      throw new ForbiddenException('Sem permissão para alterar o apontamento de outra pessoa.');
    }
    return entry;
  }

  private async alreadyRunning(running: TimeEntryRecord): Promise<ConflictException> {
    const type = FROM_ENTRY[running.docType];
    const doc = type ? await this.projects.getDocumentRef(type, running.docId) : null;
    return new ConflictException({
      message: `Você já tem um cronômetro em andamento${doc ? ` em ${doc.number} ${doc.title}` : ''}.`,
      entryId: running.id,
    });
  }

  /** Job inclui as tarefas dele (o realizado do job soma as duas coisas). */
  private async docsWithTasks(docType: TimesheetDocType, docId: string): Promise<DocRef[]> {
    const docs: DocRef[] = [{ docType: TO_ENTRY[docType], docIds: [docId] }];
    if (docType === 'job') {
      const tasks = await this.projects.getTaskIds([docId]);
      docs.push({ docType: 'TASK', docIds: tasks[docId] ?? [] });
    }
    return docs;
  }

  /** Data e minutos do apontamento manual → início ao meio-dia local e fim. */
  private async manualTimes(date: string, minutes: number): Promise<{ startedAt: Date; endedAt: Date }> {
    const { timezone } = await this.settings.getAgency();
    const error = manualEntryError(date, minutes, localDate(new Date(), timezone));
    if (error) throw new BadRequestException(error);
    const startedAt = zonedToUtc({ ...parseDate(date), hour: 12 }, timezone);
    return { startedAt, endedAt: new Date(startedAt.getTime() + minutes * 60_000) };
  }

  private async localDay(instant: Date): Promise<string> {
    const { timezone } = await this.settings.getAgency();
    return localDate(instant, timezone);
  }

  private async toViews(
    entries: TimeEntryRecord[],
    userId: string,
    access: UserPermissions | null,
  ): Promise<EntryView[]> {
    if (entries.length === 0) return [];
    const docKeys = [...new Set(entries.map((entry) => `${entry.docType}:${entry.docId}`))];
    const [users, clients, docs] = await Promise.all([
      this.auth.getUsers([...new Set(entries.map((entry) => entry.userId))]),
      this.crm.getParties(entries.map((entry) => entry.clientId).filter((id): id is string => Boolean(id))),
      Promise.all(
        docKeys.map(async (key) => {
          const [docType, docId] = key.split(':') as [EntryDocType, string];
          const type = FROM_ENTRY[docType];
          return [key, type ? await this.projects.getDocumentRef(type, docId) : null] as const;
        }),
      ),
    ]);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const clientMap = new Map(clients.map((client) => [client.id, client]));
    const docMap = new Map(docs);
    const now = new Date();
    return entries.map((entry) => {
      const user = userMap.get(entry.userId);
      const client = entry.clientId ? clientMap.get(entry.clientId) : undefined;
      const doc = docMap.get(`${entry.docType}:${entry.docId}`) ?? null;
      return {
        id: entry.id,
        user: user ? { id: user.id, name: user.name, color: user.color } : null,
        doc: {
          docType: FROM_ENTRY[entry.docType] ?? null,
          id: entry.docId,
          jobId: doc?.jobId ?? null,
          number: doc?.number ?? null,
          title: doc?.title ?? null,
          parentTitle: doc?.parentTitle ?? null,
        },
        client: client ? { id: client.id, name: client.name } : null,
        projectId: entry.projectId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        minutes: entry.situation === 'RUNNING' ? elapsedMinutes(entry.startedAt, now) : entry.minutes,
        source: entry.source,
        kind: entry.kind,
        description: entry.description,
        situation: entry.situation,
        can: { edit: access ? canManageEntry(userId, entry.userId, access) : entry.userId === userId },
      };
    });
  }
}

function parseDate(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new BadRequestException('Data inválida.');
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
