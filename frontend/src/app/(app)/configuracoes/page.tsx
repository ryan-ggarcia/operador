'use client';

import { KeyRound, Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { ErrorMessage, Loading, PageHeader } from '@/components/common';
import { useReferenceData } from '@/components/reference-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { formatDateTime } from '@/lib/format';
import { api } from '@/services';
import type { AccessProfile, Agency, UserRecord } from '@/services/types';

function AgencySection() {
  const agency = useResource(() => api.settings.agency(), []);
  if (!agency.data) return agency.error ? <ErrorMessage error={agency.error} /> : <Loading />;
  return <AgencyForm agency={agency.data} onSaved={agency.setData} />;
}

function AgencyForm({ agency, onSaved }: { agency: Agency; onSaved: (agency: Agency) => void }) {
  const [form, setForm] = useState<Partial<Agency>>(agency);
  const [saving, setSaving] = useState(false);

  const field = (key: keyof Agency, label: string) => (
    <div className="grid gap-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={(form[key] as string | null | undefined) ?? ''}
        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
      />
    </div>
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const { legalName, tradeName, cnpj, stateRegistration, municipalRegistration, email, phone } = form;
      const saved = await api.settings.updateAgency({
        legalName,
        tradeName,
        cnpj: cnpj || null,
        stateRegistration: stateRegistration || null,
        municipalRegistration: municipalRegistration || null,
        email: email || null,
        phone: phone || null,
      });
      onSaved(saved);
      toast.success('Dados da agência salvos.');
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {field('legalName', 'Razão social')}
      {field('tradeName', 'Nome fantasia')}
      {field('cnpj', 'CNPJ')}
      {field('email', 'E-mail')}
      {field('phone', 'Telefone')}
      {field('stateRegistration', 'Inscrição estadual')}
      {field('municipalRegistration', 'Inscrição municipal')}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

function NewUserDialog({ profiles, onCreated }: { profiles: AccessProfile[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileId, setProfileId] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.users.create({ name, email, accessProfileId: profileId, temporaryPassword: password });
      toast.success('Usuário criado. Passe a senha provisória para a pessoa.');
      setOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      onCreated();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            O usuário entra com a senha provisória e troca no primeiro acesso.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="user-name">Nome</Label>
            <Input id="user-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-email">E-mail de acesso</Label>
            <Input id="user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Perfil de acesso</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha o perfil" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="user-password">Senha provisória</Label>
            <Input id="user-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !profileId}>
              {saving && <Loader2 className="animate-spin" />}
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Users() {
  const { user: me } = useAuth();
  const { reload: reloadReference } = useReferenceData();
  const users = useResource(() => api.users.list(), []);
  const profiles = useResource(() => api.users.profiles(), []);

  async function changeProfile(user: UserRecord, accessProfileId: string) {
    try {
      await api.users.update(user.id, { accessProfileId });
      await users.reload();
      toast.success('Perfil alterado.');
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function toggle(user: UserRecord) {
    try {
      await api.users.setActive(user.id, !user.active);
      await Promise.all([users.reload(), reloadReference()]);
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  async function resetPassword(user: UserRecord) {
    const password = prompt(`Nova senha provisória para ${user.name} (mínimo 8 caracteres):`);
    if (!password) return;
    try {
      await api.users.resetPassword(user.id, password);
      toast.success('Senha provisória definida. A pessoa troca no próximo acesso.');
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  if (users.loading && !users.data) return <Loading />;

  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage error={users.error ?? profiles.error} />
      <div>
        <NewUserDialog
          profiles={profiles.data ?? []}
          onCreated={() => void Promise.all([users.reload(), reloadReference()])}
        />
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="w-48">Perfil</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="w-48" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.map((user) => (
              <TableRow key={user.id} className={user.active ? '' : 'opacity-60'}>
                <TableCell className="font-medium">
                  {user.name}
                  {user.isOwner && <Badge variant="secondary" className="ml-2">Dono da conta</Badge>}
                  {user.mustChangePassword && <Badge variant="outline" className="ml-2">Senha provisória</Badge>}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={user.accessProfileId ?? undefined}
                    onValueChange={(value) => void changeProfile(user, value)}
                    disabled={user.customPermissions != null}
                  >
                    <SelectTrigger className="w-full" size="sm">
                      <SelectValue placeholder={user.customPermissions ? 'Personalizado' : '—'} />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.data?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(user.lastLoginAt)}</TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="xs" onClick={() => void resetPassword(user)}>
                    <KeyRound /> Senha
                  </Button>
                  {!user.isOwner && user.id !== me?.id && (
                    <Button variant="ghost" size="xs" onClick={() => void toggle(user)}>
                      {user.active ? 'Desativar' : 'Reativar'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { permissions } = useAuth();
  if (!permissions?.flags.administrator) {
    return <ErrorMessage error={new Error('Só administradores acessam as configurações.')} />;
  }
  return (
    <>
      <PageHeader title="Configurações" />
      <Tabs defaultValue="agency">
        <TabsList>
          <TabsTrigger value="agency">Agência</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="agency" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados da agência</CardTitle>
              <CardDescription>Usados no cabeçalho dos PDFs de mídia e produção.</CardDescription>
            </CardHeader>
            <CardContent>
              <AgencySection />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users" className="pt-4">
          <Users />
        </TabsContent>
      </Tabs>
    </>
  );
}
