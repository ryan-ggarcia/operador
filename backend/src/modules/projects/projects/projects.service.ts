import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diffFields } from '../../../shared/history/diff.js';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import type { Page } from '../../../shared/validation/pagination.js';
import { ADMIN, READ_ALL, type UserPermissions } from '../../auth/public/index.js';
import {
  canChangeSituation,
  canCreateProject,
  canEditBudget,
  canEditProject,
  canEditSpecialFields,
  canUnlockProject,
  canViewBudget,
  canViewProject,
  isLockedSystemProject,
  nextProjectSituation,
  type ProjectAction,
  type ProjectSituation,
} from '../domain/project-rules.js';
import { DocumentLifecycleService } from '../document-lifecycle.service.js';
import { NamingService, type NamedRef, type UserRef } from '../naming.service.js';
import {
  PROJECT_REPOSITORY,
  type HistoryEntry,
  type JobCascade,
  type ProjectChanges,
  type ProjectRecord,
  type ProjectRepository,
} from '../repositories/project.repository.js';
import { STATUS_REPOSITORY, type StatusRepository } from '../repositories/status.repository.js';

export interface ProjectListQuery {
  search?: string;
  situations?: ProjectSituation[];
  clientId?: string;
  statusIds?: string[];
  withoutStatus?: boolean;
  responsibleId?: string;
  favoritesOnly?: boolean;
  limit: number;
  offset: number;
}

export interface CreateProjectInput {
  title: string;
  clientId: string;
  description?: string | null;
  hidden?: boolean;
}

export interface ProjectView {
  id: string;
  number: number;
  title: string;
  client: NamedRef | null;
  description: string | null;
  requester: UserRef | null;
  responsible: UserRef | null;
  members: UserRef[];
  statusId: string | null;
  situation: ProjectSituation;
  hidden: boolean;
  isClientDefault: boolean;
  locked: boolean;
  desiredDeadline: Date | null;
  /** Nulo para quem não tem a permissão de budget. */
  budget: number | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  favorite: boolean;
  openJobs?: number;
  totalJobs?: number;
  can: {
    edit: boolean;
    editSpecialFields: boolean;
    changeSituation: boolean;
    unlock: boolean;
    editBudget: boolean;
  };
}

const HISTORY_FIELDS = [
  'title',
  'description',
  'responsibleId',
  'statusId',
  'hidden',
  'desiredDeadline',
  'budget',
] as const;

const CASCADE: Record<ProjectAction, JobCascade> = {
  archive: 'complete',
  cancel: 'cancel',
  reopen: 'none',
};

/** Projetos: criação, edição, situação, envolvidos e favoritos. */
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(STATUS_REPOSITORY) private readonly statuses: StatusRepository,
    private readonly naming: NamingService,
    private readonly lifecycle: DocumentLifecycleService,
  ) {}

  async list(userId: string, access: UserPermissions, query: ProjectListQuery): Promise<Page<ProjectView>> {
    const level = access.modules.projects;
    const page = await this.projects.list({
      ...query,
      visibility: { userId, readAll: level >= READ_ALL, allHidden: level >= ADMIN },
    });
    const names = await this.naming.resolve({
      clientIds: page.items.map((item) => item.clientId),
      userIds: page.items.flatMap((item) => [item.responsibleId, item.requesterId]),
    });
    return {
      total: page.total,
      items: page.items.map((item) => ({
        ...this.toView(userId, access, item, names, item.favorite),
        members: [],
        openJobs: item.openJobs,
        totalJobs: item.totalJobs,
      })),
    };
  }

  async get(userId: string, access: UserPermissions, id: string): Promise<ProjectView> {
    const project = await this.requireViewable(userId, access, id);
    const [names, favorite] = await Promise.all([
      this.naming.resolve({
        clientIds: [project.clientId],
        userIds: [project.responsibleId, project.requesterId, ...project.memberIds],
      }),
      this.projects.isFavorite(id, userId),
    ]);
    return this.toView(userId, access, project, names, favorite);
  }

  /** Projeto que o usuário pode ver, ou erro (usado também por comentários). */
  async requireViewable(userId: string, access: UserPermissions, id: string): Promise<ProjectRecord> {
    const project = await this.projects.findById(id);
    if (!project || !canViewProject(userId, access, project)) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    return project;
  }

  async create(userId: string, access: UserPermissions, input: CreateProjectInput): Promise<ProjectView> {
    const hidden = input.hidden ?? false;
    if (!canCreateProject(access, hidden)) {
      throw new ForbiddenException(
        hidden ? 'Sem permissão para criar projetos ocultos.' : 'Sem permissão para criar projetos.',
      );
    }
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título.');
    if (!(await this.naming.isActiveClient(input.clientId))) {
      throw new BadRequestException('Cliente não encontrado ou inativo.');
    }
    // Quem cria vira solicitante e responsável.
    const project = await this.projects.create(
      {
        title,
        clientId: input.clientId,
        description: sanitizeRichText(input.description),
        hidden,
        requesterId: userId,
        responsibleId: userId,
      },
      userId,
    );
    return this.get(userId, access, project.id);
  }

  async update(
    userId: string,
    access: UserPermissions,
    id: string,
    changes: ProjectChanges,
  ): Promise<ProjectView> {
    const project = await this.requireViewable(userId, access, id);
    if (!canEditProject(userId, access, project)) {
      throw new ForbiddenException('Sem permissão para alterar este projeto.');
    }
    const data: ProjectChanges = { ...changes };

    if (data.title !== undefined) {
      if (isLockedSystemProject(project)) {
        throw new BadRequestException('O projeto Geral não pode ser renomeado.');
      }
      data.title = data.title.trim();
      if (!data.title) throw new BadRequestException('Informe o título.');
    }
    if (data.description !== undefined) data.description = sanitizeRichText(data.description);

    const special = data.responsibleId !== undefined || data.hidden !== undefined;
    if (special && !canEditSpecialFields(userId, access, project)) {
      throw new ForbiddenException('Só o responsável pode trocar o responsável ou ocultar o projeto.');
    }
    if (data.hidden !== undefined && data.hidden !== project.hidden && !access.flags.hiddenProjects) {
      throw new ForbiddenException('Sem permissão para projetos ocultos.');
    }
    if (data.responsibleId === null && !project.isClientDefault) {
      throw new BadRequestException('O projeto precisa de um responsável.');
    }
    if (data.responsibleId && !(await this.naming.areActiveUsers([data.responsibleId]))) {
      throw new BadRequestException('Responsável não encontrado ou inativo.');
    }
    if (data.statusId) await this.requireStatus(data.statusId);
    if (data.budget !== undefined && !canEditBudget(access)) {
      throw new ForbiddenException('Sem permissão para alterar o budget.');
    }

    await this.projects.update(id, data, userId, diffFields(project, data, HISTORY_FIELDS));
    return this.get(userId, access, id);
  }

  /** Desbloqueia o projeto Geral: quem desbloqueia vira o responsável. */
  async unlock(userId: string, access: UserPermissions, id: string): Promise<ProjectView> {
    const project = await this.requireViewable(userId, access, id);
    if (!isLockedSystemProject(project)) {
      throw new BadRequestException('O projeto não está bloqueado.');
    }
    if (!canUnlockProject(access)) {
      throw new ForbiddenException('Desbloquear exige permissão total em projetos.');
    }
    const changes = { responsibleId: userId };
    await this.projects.update(id, changes, userId, diffFields(project, changes, HISTORY_FIELDS));
    return this.get(userId, access, id);
  }

  /**
   * Arquivar conclui todos os jobs; cancelar cancela todos; reabrir pode
   * reabrir os jobs também.
   */
  async changeSituation(
    userId: string,
    access: UserPermissions,
    id: string,
    action: ProjectAction,
    reopenDocuments = false,
  ): Promise<ProjectView> {
    const project = await this.requireViewable(userId, access, id);
    if (!canChangeSituation(userId, access, project)) {
      throw new ForbiddenException(
        isLockedSystemProject(project)
          ? 'O projeto Geral está bloqueado: desbloqueie antes.'
          : 'Sem permissão para mudar a situação deste projeto.',
      );
    }
    const next = nextProjectSituation(project.situation, action);
    if (!next) throw new BadRequestException('O projeto já está nesta situação.');
    // Projeto com faturas não cancela (projetos.md, regra 6): quem barra é o financeiro.
    if (next === 'CANCELED') await this.lifecycle.beforeProjectCancel(id);
    const cascade = action === 'reopen' && reopenDocuments ? 'reopen' : CASCADE[action];
    await this.projects.changeSituation(id, next, cascade, userId);
    // Ex.: o timesheet para os cronômetros ativos nos documentos do projeto.
    if (next !== 'OPEN') {
      await this.lifecycle.afterProjectClosed(id, userId, next === 'ARCHIVED' ? 'archived' : 'canceled');
    }
    return this.get(userId, access, id);
  }

  async addMembers(userId: string, access: UserPermissions, id: string, userIds: string[]): Promise<ProjectView> {
    await this.requireEditable(userId, access, id);
    if (!(await this.naming.areActiveUsers(userIds))) {
      throw new BadRequestException('Usuário não encontrado ou inativo.');
    }
    await this.projects.addMembers(id, [...new Set(userIds)]);
    return this.get(userId, access, id);
  }

  async removeMember(userId: string, access: UserPermissions, id: string, memberId: string): Promise<ProjectView> {
    const project = await this.requireEditable(userId, access, id);
    if (project.responsibleId === memberId) {
      throw new BadRequestException('O responsável não pode sair dos envolvidos.');
    }
    await this.projects.removeMember(id, memberId);
    return this.get(userId, access, id);
  }

  /** Favoritar só em projeto aberto; favorito é por usuário. */
  async setFavorite(userId: string, access: UserPermissions, id: string, favorite: boolean): Promise<void> {
    const project = await this.requireViewable(userId, access, id);
    if (favorite && project.situation !== 'OPEN') {
      throw new BadRequestException('Só projetos abertos podem ser favoritados.');
    }
    await this.projects.setFavorite(id, userId, favorite);
  }

  async history(userId: string, access: UserPermissions, id: string): Promise<HistoryEntry[]> {
    await this.requireViewable(userId, access, id);
    const entries = await this.projects.listHistory('project', id);
    if (canViewBudget(access)) return entries;
    return entries.filter((entry) => entry.field !== 'budget');
  }

  private async requireEditable(userId: string, access: UserPermissions, id: string): Promise<ProjectRecord> {
    const project = await this.requireViewable(userId, access, id);
    if (!canEditProject(userId, access, project)) {
      throw new ForbiddenException('Sem permissão para alterar este projeto.');
    }
    return project;
  }

  private async requireStatus(statusId: string): Promise<void> {
    const status = await this.statuses.findById(statusId);
    if (!status || status.docType !== 'PROJECT' || !status.active) {
      throw new BadRequestException('Status de projeto não encontrado.');
    }
  }

  private toView(
    userId: string,
    access: UserPermissions,
    project: ProjectRecord,
    names: Awaited<ReturnType<NamingService['resolve']>>,
    favorite: boolean,
  ): ProjectView {
    return {
      id: project.id,
      number: project.number,
      title: project.title,
      client: names.client(project.clientId),
      description: project.description,
      requester: names.user(project.requesterId),
      responsible: names.user(project.responsibleId),
      members: names.users(project.memberIds),
      statusId: project.statusId,
      situation: project.situation,
      hidden: project.hidden,
      isClientDefault: project.isClientDefault,
      locked: isLockedSystemProject(project),
      desiredDeadline: project.desiredDeadline,
      budget: canViewBudget(access) ? project.budget : null,
      closedAt: project.closedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      favorite,
      can: {
        edit: canEditProject(userId, access, project),
        editSpecialFields: canEditSpecialFields(userId, access, project),
        changeSituation: canChangeSituation(userId, access, project),
        unlock: isLockedSystemProject(project) && canUnlockProject(access),
        editBudget: canEditBudget(access) && canEditProject(userId, access, project),
      },
    };
  }
}
