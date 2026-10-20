import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { UserPermissions } from '../auth/public/index.js';
import {
  FILES_FACADE,
  type FileOwnerAccess,
  type FileOwnerRegistry,
  type FileOwnerResolver,
} from '../files/public/index.js';
import { canViewBill, canWriteKind } from './domain/bill-rules.js';
import { BILL_REPOSITORY, type BillRepository } from './repositories/finance.repository.js';

/**
 * Anexos do lançamento (notas, comprovantes): vê quem vê o lançamento; envia
 * quem lança aquele tipo (receita ou despesa), mesmo depois de quitado.
 */
@Injectable()
export class FinanceFileOwner implements FileOwnerResolver, OnModuleInit {
  readonly module = 'finance';
  readonly ownerTypes = ['bill'] as const;

  constructor(
    @Inject(BILL_REPOSITORY) private readonly bills: BillRepository,
    @Inject(FILES_FACADE) private readonly files: FileOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.files.registerOwner(this);
  }

  async resolve(_ownerType: string, ownerId: string, userId: string, access: UserPermissions): Promise<FileOwnerAccess | null> {
    const bill = await this.bills.findById(ownerId);
    if (!bill || !canViewBill(userId, access, bill)) return null;
    return { canView: true, canChange: canWriteKind(access, bill.kind) };
  }
}
