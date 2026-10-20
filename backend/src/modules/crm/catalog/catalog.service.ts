import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  type CatalogItem,
  type CatalogKind,
  type CatalogRepository,
} from '../repositories/contact.repository.js';

const LABEL: Record<CatalogKind, string> = {
  clientGroup: 'grupo de clientes',
  department: 'departamento',
};

/** Grupos de clientes e departamentos de contatos: nome único. */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository,
  ) {}

  list(kind: CatalogKind): Promise<CatalogItem[]> {
    return this.repository.list(kind);
  }

  async create(kind: CatalogKind, name: string): Promise<CatalogItem> {
    const clean = name.trim();
    if (await this.repository.nameInUse(kind, clean)) {
      throw new ConflictException(`Já existe um ${LABEL[kind]} com este nome.`);
    }
    return this.repository.create(kind, clean);
  }

  async update(
    kind: CatalogKind,
    id: string,
    changes: { name?: string; active?: boolean },
  ): Promise<CatalogItem> {
    if (!(await this.repository.exists(kind, id))) {
      throw new NotFoundException(`O ${LABEL[kind]} não foi encontrado.`);
    }
    const name = changes.name?.trim();
    if (name && (await this.repository.nameInUse(kind, name, id))) {
      throw new ConflictException(`Já existe um ${LABEL[kind]} com este nome.`);
    }
    return this.repository.update(kind, id, { name, active: changes.active });
  }
}
