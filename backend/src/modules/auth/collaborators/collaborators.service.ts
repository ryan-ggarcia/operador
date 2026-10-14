import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidDocument, onlyDigits } from '../../../shared/validation/br-document.js';
import {
  COLLABORATOR_REPOSITORY,
  type CollaboratorData,
  type CollaboratorFilter,
  type CollaboratorRecord,
  type CollaboratorRepository,
  type PositionRecord,
} from '../repositories/collaborator.repository.js';

/** Cadastro de colaboradores (dados de RH) e das funções. */
@Injectable()
export class CollaboratorsService {
  constructor(
    @Inject(COLLABORATOR_REPOSITORY)
    private readonly repository: CollaboratorRepository,
  ) {}

  list(filter: CollaboratorFilter): Promise<CollaboratorRecord[]> {
    return this.repository.list(filter);
  }

  async get(id: string): Promise<CollaboratorRecord> {
    const collaborator = await this.repository.findById(id);
    if (!collaborator) throw new NotFoundException('Colaborador não encontrado.');
    return collaborator;
  }

  async create(data: CollaboratorData, actorId: string): Promise<CollaboratorRecord> {
    const clean = await this.validate(data);
    return this.repository.create(clean, actorId);
  }

  async update(
    id: string,
    data: Partial<CollaboratorData>,
    actorId: string,
  ): Promise<CollaboratorRecord> {
    const current = await this.get(id);
    const clean = await this.validate({ ...current, ...data }, id);
    return this.repository.update(id, pick(clean, data), actorId);
  }

  async setActive(id: string, active: boolean, actorId: string): Promise<CollaboratorRecord> {
    await this.get(id);
    return this.repository.update(id, { active }, actorId);
  }

  listPositions(): Promise<PositionRecord[]> {
    return this.repository.listPositions();
  }

  async createPosition(name: string): Promise<PositionRecord> {
    const clean = name.trim();
    if (await this.repository.positionNameInUse(clean)) {
      throw new ConflictException('Já existe uma função com este nome.');
    }
    return this.repository.createPosition(clean);
  }

  async updatePosition(
    id: string,
    changes: { name?: string; active?: boolean },
  ): Promise<PositionRecord> {
    if (!(await this.repository.findPosition(id))) {
      throw new NotFoundException('Função não encontrada.');
    }
    const name = changes.name?.trim();
    if (name && (await this.repository.positionNameInUse(name, id))) {
      throw new ConflictException('Já existe uma função com este nome.');
    }
    return this.repository.updatePosition(id, { name, active: changes.active });
  }

  /** Documento obrigatório e válido (CPF ou CNPJ), sem repetir. */
  private async validate(data: CollaboratorData, exceptId?: string): Promise<CollaboratorData> {
    const document = data.document ? onlyDigits(data.document) : '';
    if (!document) throw new BadRequestException('Informe o CPF ou CNPJ do colaborador.');
    if (!isValidDocument(document, data.personType)) {
      throw new BadRequestException(
        data.personType === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.',
      );
    }
    if (await this.repository.documentInUse(document, exceptId)) {
      throw new ConflictException('Já existe um colaborador com este documento.');
    }
    if (data.positionId && !(await this.repository.findPosition(data.positionId))) {
      throw new BadRequestException('Função não encontrada.');
    }
    if (data.dismissalDate && data.admissionDate && data.dismissalDate < data.admissionDate) {
      throw new BadRequestException('A data de desligamento é anterior à admissão.');
    }
    return { ...data, name: data.name.trim(), document };
  }
}

/** Só os campos que vieram na alteração, já limpos. */
function pick(clean: CollaboratorData, changed: Partial<CollaboratorData>): Partial<CollaboratorData> {
  const result: Partial<CollaboratorData> = {};
  for (const key of Object.keys(changed) as (keyof CollaboratorData)[]) {
    (result as Record<string, unknown>)[key] = clean[key];
  }
  return result;
}
