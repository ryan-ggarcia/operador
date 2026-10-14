'use client';

import { Loader2, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { ErrorMessage, Loading, PageHeader } from '@/components/common';
import { ROLES } from '@/components/parties/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { formatDocument } from '@/lib/format';
import { api } from '@/services';
import type { Party, PartyInput } from '@/services/types';

const FIELDS: { key: keyof PartyInput; label: string; span?: 2 }[] = [
  { key: 'name', label: 'Nome fantasia', span: 2 },
  { key: 'legalName', label: 'Razão social', span: 2 },
  { key: 'document', label: 'CPF/CNPJ' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone1', label: 'Telefone' },
  { key: 'phone2', label: 'Telefone 2' },
  { key: 'website', label: 'Site', span: 2 },
  { key: 'zipCode', label: 'CEP' },
  { key: 'street', label: 'Logradouro' },
  { key: 'number', label: 'Número' },
  { key: 'complement', label: 'Complemento' },
  { key: 'district', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
];

function PartyForm({ party, canEdit, onSaved }: { party: Party; canEdit: boolean; onSaved: (party: Party) => void }) {
  const { can } = useAuth();
  const [form, setForm] = useState<PartyInput>(() =>
    Object.fromEntries(FIELDS.map(({ key }) => [key, (party[key as keyof Party] as string | null) ?? ''])),
  );
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const changes = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value === '' ? null : value]),
      ) as PartyInput;
      const updated = await api.parties.update(party.id, { ...changes, name: form.name as string });
      toast.success('Cadastro salvo.');
      onSaved(updated);
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRole(field: (typeof ROLES)[number]['field'], value: boolean) {
    try {
      onSaved(await api.parties.update(party.id, { [field]: value }));
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="flex flex-wrap gap-4">
        {ROLES.map((item) => (
          <Label key={item.role} className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={party[item.field]}
              disabled={!canEdit || !can(item.module, 6)}
              onCheckedChange={(value) => void toggleRole(item.field, value === true)}
            />
            {item.label}
          </Label>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, span }) => (
          <div key={key} className={`grid gap-2 ${span === 2 ? 'sm:col-span-2' : ''}`}>
            <Label htmlFor={key}>{label}</Label>
            <Input
              id={key}
              disabled={!canEdit}
              required={key === 'name'}
              value={(form[key] as string | undefined) ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            />
          </div>
        ))}
      </div>
      {canEdit && (
        <div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </div>
      )}
    </form>
  );
}

function Contacts({ partyId, canEdit }: { partyId: string; canEdit: boolean }) {
  const contacts = useResource(() => api.parties.contacts(partyId, true), [partyId]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  async function add(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.parties.createContact(partyId, { name, email: email || null, phone1: phone || null });
      setName('');
      setEmail('');
      setPhone('');
      await contacts.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function toggle(id: string, active: boolean) {
    try {
      await api.parties.updateContact(id, { active });
      await contacts.reload();
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {contacts.data && contacts.data.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.data.map((contact) => (
                <TableRow key={contact.id} className={contact.active ? '' : 'opacity-60'}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.email ?? '—'}</TableCell>
                  <TableCell>{contact.phone1 ?? '—'}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <Button variant="ghost" size="xs" onClick={() => void toggle(contact.id, !contact.active)}>
                        {contact.active ? 'Desativar' : 'Reativar'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {contacts.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contato.</p>}
      {canEdit && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input className="w-48" placeholder="Nome" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input className="w-56" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input className="w-40" placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button type="submit" variant="outline">
            <Plus /> Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

export default function PartyPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const party = useResource(() => api.parties.get(id), [id]);

  if (party.loading && !party.data) return <Loading />;
  if (!party.data) return <ErrorMessage error={party.error} />;
  const data = party.data;
  const canEdit = ROLES.some((item) => data[item.field] && can(item.module, 6));

  async function toggleActive() {
    try {
      party.setData(await api.parties.setActive(id, !data.active));
      toast.success(data.active ? 'Cadastro desativado.' : 'Cadastro reativado.');
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {data.name}
            {!data.active && <Badge variant="outline">Inativo</Badge>}
          </span>
        }
        description={`${data.personType === 'PJ' ? 'CNPJ' : 'CPF'} ${formatDocument(data.document)}`}
        actions={
          canEdit && (
            <Button variant="outline" onClick={() => void toggleActive()}>
              {data.active ? 'Desativar' : 'Reativar'}
            </Button>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <PartyForm key={data.updatedAt} party={data} canEdit={canEdit} onSaved={party.setData} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contatos</CardTitle>
            </CardHeader>
            <CardContent>
              <Contacts partyId={data.id} canEdit={canEdit} />
            </CardContent>
          </Card>
          {data.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea readOnly value={data.notes.replace(/<[^>]+>/g, '')} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
