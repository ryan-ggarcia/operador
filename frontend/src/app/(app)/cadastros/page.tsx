'use client';

import { Loader2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { EmptyState, ErrorMessage, Loading, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { formatDocument } from '@/lib/format';
import { api, ApiError } from '@/services';
import { ROLES } from '@/components/parties/roles';
import type { PartyRole } from '@/services/types';

function NewPartyDialog({ defaultRole, onCreated }: { defaultRole: PartyRole; onCreated: () => void }) {
  const router = useRouter();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [personType, setPersonType] = useState<'PJ' | 'PF'>('PJ');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<PartyRole[]>([defaultRole]);
  const [saving, setSaving] = useState(false);
  const writable = ROLES.filter((item) => can(item.module, 6));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const party = await api.parties.create({
        name,
        personType,
        document: document || null,
        email: email || null,
        ...Object.fromEntries(ROLES.map((item) => [item.field, roles.includes(item.role)])),
      });
      toast.success('Cadastro criado.');
      setOpen(false);
      onCreated();
      router.push(`/cadastros/${party.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        const details = caught.details as { partyId?: string; partyName?: string };
        toast.error(`Já existe o cadastro "${details.partyName}" com este documento.`, {
          action: details.partyId
            ? { label: 'Abrir', onClick: () => router.push(`/cadastros/${details.partyId}`) }
            : undefined,
        });
      } else {
        toast.error((caught as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setRoles([defaultRole]);
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={writable.length === 0}>
          <Plus /> Novo cadastro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cadastro</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="party-name">Nome fantasia</Label>
            <Input id="party-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <div className="grid gap-2">
              <Label>Pessoa</Label>
              <Select value={personType} onValueChange={(value) => setPersonType(value as 'PJ' | 'PF')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PJ">Jurídica</SelectItem>
                  <SelectItem value="PF">Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="party-document">{personType === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
              <Input id="party-document" value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="party-email">E-mail</Label>
            <Input id="party-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Papéis</Label>
            <div className="flex flex-wrap gap-4">
              {writable.map((item) => (
                <Label key={item.role} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={roles.includes(item.role)}
                    onCheckedChange={(checked) =>
                      setRoles((current) =>
                        checked ? [...current, item.role] : current.filter((role) => role !== item.role),
                      )
                    }
                  />
                  {item.label}
                </Label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || roles.length === 0}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function PartiesPage() {
  const { can } = useAuth();
  const readable = ROLES.filter((item) => can(item.module));
  const [role, setRole] = useState<PartyRole>(readable[0]?.role ?? 'client');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('true');

  const parties = useResource(
    () => api.parties.list({ role, search: query || undefined, active: active === 'all' ? undefined : active === 'true', limit: 200 }),
    [role, query, active],
  );

  return (
    <>
      <PageHeader
        title="Cadastros"
        description="Uma pessoa pode ter vários papéis: o mesmo CNPJ não vira dois cadastros."
        actions={<NewPartyDialog defaultRole={role} onCreated={() => void parties.reload()} />}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={role} onValueChange={(value) => setRole(value as PartyRole)}>
          <TabsList>
            {readable.map((item) => (
              <TabsTrigger key={item.role} value={item.role}>
                {item.plural}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          className="relative w-64"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Nome, e-mail ou documento"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => setQuery(search.trim())}
          />
        </form>
        <Select value={active} onValueChange={setActive}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Ativos</SelectItem>
            <SelectItem value="false">Inativos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ErrorMessage error={parties.error} />
      {parties.loading && !parties.data ? (
        <Loading />
      ) : parties.data?.items.length === 0 ? (
        <EmptyState>Nenhum cadastro encontrado.</EmptyState>
      ) : (
        parties.data && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Papéis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parties.data.items.map((party) => (
                  <TableRow key={party.id} className={party.active ? '' : 'opacity-60'}>
                    <TableCell>
                      <Link href={`/cadastros/${party.id}`} className="font-medium hover:underline">
                        {party.name}
                      </Link>
                      {party.legalName && <div className="text-xs text-muted-foreground">{party.legalName}</div>}
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDocument(party.document)}</TableCell>
                    <TableCell className="text-sm">{party.email ?? party.phone1 ?? '—'}</TableCell>
                    <TableCell className="text-sm">{party.city ? `${party.city}${party.state ? `/${party.state}` : ''}` : '—'}</TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      {party.roles.map((item) => (
                        <Badge key={item} variant="secondary">
                          {ROLES.find((entry) => entry.role === item)?.label}
                        </Badge>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      )}
    </>
  );
}
