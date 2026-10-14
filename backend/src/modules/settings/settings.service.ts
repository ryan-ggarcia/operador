import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { isValidCnpj, onlyDigits } from '../../shared/validation/br-document.js';
import type { Agency, SettingsFacade } from './public/settings.facade.js';
import {
  AGENCY_REPOSITORY,
  type AgencyRepository,
} from './repositories/agency.repository.js';

/** Valores enquanto a agência ainda não foi cadastrada. */
export const DEFAULT_AGENCY: Agency = {
  legalName: '',
  tradeName: '',
  cnpj: null,
  stateRegistration: null,
  municipalRegistration: null,
  email: null,
  phone: null,
  address: null,
  logoFileId: null,
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  locale: 'pt-BR',
};

@Injectable()
export class SettingsService implements SettingsFacade {
  constructor(
    @Inject(AGENCY_REPOSITORY) private readonly repository: AgencyRepository,
  ) {}

  async getAgency(): Promise<Agency> {
    return (await this.repository.find()) ?? DEFAULT_AGENCY;
  }

  async updateAgency(changes: Partial<Agency>): Promise<Agency> {
    const next: Agency = { ...(await this.getAgency()), ...stripUndefined(changes) };
    if (!next.legalName.trim() || !next.tradeName.trim()) {
      throw new BadRequestException('Informe a razão social e o nome fantasia.');
    }
    if (next.cnpj) {
      next.cnpj = onlyDigits(next.cnpj);
      if (!isValidCnpj(next.cnpj)) throw new BadRequestException('CNPJ inválido.');
    }
    if (!isValidTimezone(next.timezone)) {
      throw new BadRequestException('Fuso horário inválido.');
    }
    return this.repository.save({
      ...next,
      legalName: next.legalName.trim(),
      tradeName: next.tradeName.trim(),
    });
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
