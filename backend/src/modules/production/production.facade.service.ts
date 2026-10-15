import { Inject, Injectable } from '@nestjs/common';
import type { ProductionFacade, ProductionSummary } from './public/production.facade.js';
import { PRODUCTION_REPOSITORY, type ProductionRepository } from './repositories/production.repository.js';

@Injectable()
export class ProductionFacadeService implements ProductionFacade {
  constructor(@Inject(PRODUCTION_REPOSITORY) private readonly productions: ProductionRepository) {}

  getSummaryByProject(projectId: string): Promise<ProductionSummary> {
    return this.summarize({ projectId });
  }

  getSummaryByClient(clientId: string): Promise<ProductionSummary> {
    return this.summarize({ clientId });
  }

  private async summarize(filter: { projectId?: string; clientId?: string }): Promise<ProductionSummary> {
    const page = await this.productions.list({ ...filter, visibility: { userId: '', readAll: true }, limit: 1000, offset: 0 });
    const active = page.items.filter((item) => item.situation !== 'CANCELED');
    return {
      count: page.total,
      open: page.items.filter((item) => item.situation === 'OPEN').length,
      totalValue: Math.round(active.reduce((sum, item) => sum + item.totalValue, 0) * 100) / 100,
      commissionTotal: Math.round(active.reduce((sum, item) => sum + item.commissionTotal, 0) * 100) / 100,
    };
  }
}
