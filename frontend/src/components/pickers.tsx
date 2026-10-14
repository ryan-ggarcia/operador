'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/services';
import type { NamedRef, PartyRole, Status, UserRef } from '@/services/types';

const NONE = '__none__';

/** Busca de clientes, fornecedores etc. pelo nome (só ativos). */
export function PartyPicker({
  role,
  value,
  onChange,
  placeholder = 'Selecione',
  disabled,
}: {
  role: PartyRole;
  value: NamedRef | null;
  onChange: (value: NamedRef | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<NamedRef[]>([]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      api.parties
        .options(role, search)
        .then((items) => setOptions(items.map(({ id, name }) => ({ id, name }))))
        .catch(() => setOptions([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [open, search, role]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal">
          <span className={value ? '' : 'text-muted-foreground'}>{value?.name ?? placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar pelo nome…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Check className={value?.id === option.id ? 'opacity-100' : 'opacity-0'} />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function UserSelect({
  users,
  value,
  onChange,
  placeholder = 'Ninguém',
  allowEmpty = true,
  disabled,
}: {
  users: UserRef[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={NONE}>{placeholder}</SelectItem>}
        {users.map((user) => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusSelect({
  statuses,
  value,
  onChange,
  disabled,
  emptyLabel = 'Sem status',
}: {
  statuses: Status[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  /** Texto da opção vazia (num filtro: "Todos os status"). */
  emptyLabel?: string;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{emptyLabel}</SelectItem>
        {statuses.map((status) => (
          <SelectItem key={status.id} value={status.id}>
            <span className="size-2 rounded-full" style={{ backgroundColor: status.color }} />
            {status.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
