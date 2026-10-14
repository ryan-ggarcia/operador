/** Token de injeção da fachada do módulo settings. */
export const SETTINGS_FACADE = Symbol('SETTINGS_FACADE');

export interface AgencyAddress {
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}

/** Dados da agência, usados nos PDFs e no cabeçalho do sistema. */
export interface Agency {
  legalName: string;
  tradeName: string;
  cnpj: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone: string | null;
  address: AgencyAddress | null;
  logoFileId: string | null;
  timezone: string;
  currency: string;
  locale: string;
}

/** Interface pública do módulo settings. */
export interface SettingsFacade {
  getAgency(): Promise<Agency>;
}
