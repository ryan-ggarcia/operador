import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import { FULL, type UserPermissions } from '../../auth/public/index.js';
import {
  STATUS_REPOSITORY,
  type PredefinedBriefingRecord,
  type ProjectDocType,
  type StatusData,
  type StatusRecord,
  type StatusRepository,
} from '../repositories/status.repository.js';

/** Configurar status e briefings exige nível Total no módulo do documento. */
function assertCanConfigure(access: UserPermissions, docType: ProjectDocType): void {
  const level = docType === 'PROJECT' ? access.modules.projects : access.modules.jobs;
  if (level < FULL) throw new ForbiddenException('Sem permissão para alterar as configurações.');
}

/** Status de projetos e de jobs/tarefas e briefings predefinidos. */
@Injectable()
export class StatusesService {
  constructor(
    @Inject(STATUS_REPOSITORY) private readonly repository: StatusRepository,
  ) {}

  list(docType: ProjectDocType, includeInactive: boolean): Promise<StatusRecord[]> {
    return this.repository.list(docType, includeInactive);
  }

  async create(access: UserPermissions, docType: ProjectDocType, data: StatusData): Promise<StatusRecord> {
    assertCanConfigure(access, docType);
    const name = data.name.trim();
    if (await this.repository.nameInUse(docType, name)) {
      throw new ConflictException('Já existe um status com este nome.');
    }
    return this.repository.create(docType, { ...data, name });
  }

  async update(access: UserPermissions, id: string, data: Partial<StatusData>): Promise<StatusRecord> {
    const status = await this.repository.findById(id);
    if (!status) throw new NotFoundException('Status não encontrado.');
    assertCanConfigure(access, status.docType);
    if (status.system && data.active === false) {
      throw new BadRequestException('Status do sistema não pode ser desativado.');
    }
    const name = data.name?.trim();
    if (name && (await this.repository.nameInUse(status.docType, name, id))) {
      throw new ConflictException('Já existe um status com este nome.');
    }
    return this.repository.update(id, { ...data, name });
  }

  async reorder(access: UserPermissions, docType: ProjectDocType, ids: string[]): Promise<StatusRecord[]> {
    assertCanConfigure(access, docType);
    const current = await this.repository.list(docType, true);
    const known = new Set(current.map((status) => status.id));
    if (new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw new BadRequestException('Lista de status inválida.');
    }
    await this.repository.reorder(docType, ids);
    return this.repository.list(docType, true);
  }

  listBriefings(docType: ProjectDocType, includeInactive: boolean): Promise<PredefinedBriefingRecord[]> {
    return this.repository.listBriefings(docType, includeInactive);
  }

  async createBriefing(
    access: UserPermissions,
    docType: ProjectDocType,
    title: string,
    html: string,
  ): Promise<PredefinedBriefingRecord> {
    assertCanConfigure(access, docType);
    const clean = sanitizeRichText(html);
    if (!clean) throw new BadRequestException('O briefing está vazio.');
    return this.repository.createBriefing(docType, title.trim(), clean);
  }

  async updateBriefing(
    access: UserPermissions,
    id: string,
    data: { title?: string; html?: string; active?: boolean },
  ): Promise<PredefinedBriefingRecord> {
    const briefing = await this.repository.findBriefing(id);
    if (!briefing) throw new NotFoundException('Briefing não encontrado.');
    assertCanConfigure(access, briefing.docType);
    const html = data.html === undefined ? undefined : sanitizeRichText(data.html);
    if (html === null) throw new BadRequestException('O briefing está vazio.');
    return this.repository.updateBriefing(id, { ...data, title: data.title?.trim(), html });
  }
}
