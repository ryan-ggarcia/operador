import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { UserPermissions } from '../auth/public/index.js';
import {
  FILES_FACADE,
  type FileOwnerAccess,
  type FileOwnerRegistry,
  type FileOwnerResolver,
} from '../files/public/index.js';
import { rolesOf } from './crm.facade.service.js';
import { canReadParty, canWriteParty } from './domain/party-access.js';
import { PARTY_REPOSITORY, type PartyRepository } from './repositories/party.repository.js';

/** Anexos do cadastro: vê quem lê algum papel da pessoa; envia quem pode alterá-la. */
@Injectable()
export class CrmFileOwner implements FileOwnerResolver, OnModuleInit {
  readonly module = 'crm';
  readonly ownerTypes = ['party'] as const;

  constructor(
    @Inject(PARTY_REPOSITORY) private readonly parties: PartyRepository,
    @Inject(FILES_FACADE) private readonly files: FileOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.files.registerOwner(this);
  }

  async resolve(_ownerType: string, ownerId: string, _userId: string, access: UserPermissions): Promise<FileOwnerAccess | null> {
    const party = await this.parties.findDetail(ownerId);
    if (!party) return null;
    const roles = rolesOf(party);
    if (!canReadParty(access, roles)) return null;
    return { canView: true, canChange: canWriteParty(access, roles) };
  }
}
