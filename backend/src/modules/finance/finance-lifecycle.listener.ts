import { BadRequestException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  PROJECTS_FACADE,
  type DocumentLifecycleListener,
  type ProjectsFacade,
} from '../projects/public/index.js';
import { BILL_REPOSITORY, type BillRepository } from './repositories/finance.repository.js';

/** Projeto com faturas não pode ser cancelado (docs/operand/projetos.md, regra 6). */
@Injectable()
export class FinanceLifecycleListener implements DocumentLifecycleListener, OnModuleInit {
  constructor(
    @Inject(BILL_REPOSITORY) private readonly bills: BillRepository,
    @Inject(PROJECTS_FACADE) private readonly projects: ProjectsFacade,
  ) {}

  onModuleInit(): void {
    this.projects.registerLifecycleListener(this);
  }

  async beforeProjectCancel(projectId: string): Promise<void> {
    const count = await this.bills.countActiveByProject(projectId);
    if (count > 0) {
      throw new BadRequestException(
        `O projeto tem ${count} fatura(s) no financeiro: cancele-as (ou reabra o faturamento dos documentos) antes.`,
      );
    }
  }
}
