import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sanitizeRichText } from '../../../shared/html/sanitize.js';
import {
  PRODUCTION_CATALOG_REPOSITORY,
  type PredefinedTextKind,
  type PredefinedTextRecord,
  type ProductionCatalogRepository,
  type StatusRecord,
  type TaxRecord,
} from '../repositories/production.repository.js';

/** Encargos, status e textos predefinidos (condições, observações, briefing). */
@Injectable()
export class ProductionCatalogService {
  constructor(
    @Inject(PRODUCTION_CATALOG_REPOSITORY) private readonly catalog: ProductionCatalogRepository,
  ) {}

  listTaxes(): Promise<TaxRecord[]> {
    return this.catalog.listTaxes();
  }

  /** O encargo padrão não pode ser inativado; marcar outro como padrão tira o anterior. */
  async saveTax(
    id: string | null,
    input: { title: string; type: string | null; percent: number; active: boolean; isDefault?: boolean },
  ): Promise<TaxRecord> {
    const title = input.title.trim();
    if (!title) throw new BadRequestException('Informe o título do encargo.');
    if (input.percent < 0 || input.percent > 100) throw new BadRequestException('Percentual entre 0 e 100.');
    const current = id ? await this.catalog.findTax(id) : null;
    if (id && !current) throw new NotFoundException('Encargo não encontrado.');
    if (current?.isDefault && !input.active) throw new BadRequestException('O encargo padrão não pode ser inativado.');
    const { isDefault, ...data } = input;
    const saved = await this.catalog.saveTax(id, { ...data, title, type: data.type?.trim() || null });
    if (isDefault && !saved.isDefault) await this.catalog.makeDefaultTax(saved.id);
    return (await this.catalog.findTax(saved.id))!;
  }

  listStatuses(includeInactive: boolean): Promise<StatusRecord[]> {
    return this.catalog.listStatuses(includeInactive);
  }

  listTexts(kind?: PredefinedTextKind): Promise<PredefinedTextRecord[]> {
    return this.catalog.listTexts(kind);
  }

  async saveText(id: string | null, input: Omit<PredefinedTextRecord, 'id'>): Promise<PredefinedTextRecord> {
    const title = input.title.trim();
    const html = sanitizeRichText(input.html);
    if (!title || !html) throw new BadRequestException('Informe o título e o texto.');
    return this.catalog.saveText(id, { ...input, title, html });
  }
}
