import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { canEditOwn, FULL, type UserPermissions } from '../auth/public/index.js';
import {
  FILES_FACADE,
  type FileOwnerAccess,
  type FileOwnerRegistry,
  type FileOwnerResolver,
} from '../files/public/index.js';
import { PROJECTS_FACADE, type ProjectDocumentType, type ProjectsFacade } from './public/projects.facade.js';

/**
 * Anexos de projetos, jobs e tarefas: vê quem vê o documento; envia e exclui
 * quem pode alterá-lo (documento aberto; níveis 1 e 3 só quando envolvido).
 */
@Injectable()
export class ProjectsFileOwner implements FileOwnerResolver, OnModuleInit {
  readonly module = 'projects';
  readonly ownerTypes: readonly ProjectDocumentType[] = ['project', 'job', 'task'];

  constructor(
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
    @Inject(FILES_FACADE) private readonly files: FileOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.files.registerOwner(this);
  }

  async resolve(ownerType: string, ownerId: string, userId: string, access: UserPermissions): Promise<FileOwnerAccess | null> {
    const docType = ownerType as ProjectDocumentType;
    const ref = await this.projects.getDocumentForUser(docType, ownerId, userId, access);
    if (!ref) return null;
    const level = access.modules[docType === 'project' ? 'projects' : 'jobs'];
    const involved = ref.involvedUserIds.includes(userId);
    return { canView: true, canChange: ref.open && canEditOwn(level) && (level >= FULL || involved) };
  }
}
