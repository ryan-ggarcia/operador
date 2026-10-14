import type { PartyRole, PermissionModule } from '@/services/types';

/** Papéis de um cadastro e a permissão de cada um. */
export const ROLES: { role: PartyRole; label: string; plural: string; module: PermissionModule; field: 'isClient' | 'isSupplier' | 'isProvider' | 'isVehicle' }[] = [
  { role: 'client', label: 'Cliente', plural: 'Clientes', module: 'clients', field: 'isClient' },
  { role: 'supplier', label: 'Fornecedor', plural: 'Fornecedores', module: 'suppliers', field: 'isSupplier' },
  { role: 'provider', label: 'Prestador', plural: 'Prestadores', module: 'providers', field: 'isProvider' },
  { role: 'vehicle', label: 'Veículo', plural: 'Veículos', module: 'vehicles', field: 'isVehicle' },
];

