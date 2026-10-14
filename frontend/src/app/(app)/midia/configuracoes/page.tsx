'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { ErrorMessage, PageHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResource } from '@/hooks/use-resource';
import { api } from '@/services';
import type { Network } from '@/services/media.service';

const NETWORK_TYPE: Record<Network['type'], string> = {
  OPEN_TV: 'TV aberta',
  PAY_TV: 'TV por assinatura',
  RADIO: 'Rádio',
  OTHER: 'Outros',
};
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

async function attempt(action: () => Promise<unknown>, success: string): Promise<boolean> {
  try {
    await action();
    toast.success(success);
    return true;
  } catch (caught) {
    toast.error((caught as Error).message);
    return false;
  }
}

function Networks({ canEdit }: { canEdit: boolean }) {
  const networks = useResource(() => api.media.networks(), []);
  const [name, setName] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [type, setType] = useState<Network['type']>('OPEN_TV');
  return (
    <div className="flex flex-col gap-3">
      <ErrorMessage error={networks.error} />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rede</TableHead>
              <TableHead className="w-28">Mnemônico</TableHead>
              <TableHead className="w-40">Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {networks.data?.map((network) => (
              <TableRow key={network.id}>
                <TableCell>{network.name}</TableCell>
                <TableCell className="font-mono">{network.mnemonic}</TableCell>
                <TableCell>{NETWORK_TYPE[network.type]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {canEdit && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await attempt(() => api.media.saveNetwork(null, { name, mnemonic, type, active: true }), 'Rede criada.')
            ) {
              setName('');
              setMnemonic('');
              await networks.reload();
            }
          }}
        >
          <Input
            className="w-64"
            placeholder="Nome da rede"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="w-32"
            placeholder="Mnemônico"
            required
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
          />
          <Select value={type} onValueChange={(value) => setType(value as Network['type'])}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(NETWORK_TYPE).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline">
            <Plus /> Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

function Markets({ canEdit }: { canEdit: boolean }) {
  const markets = useResource(() => api.media.markets(), []);
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Praça</TableHead>
              <TableHead className="w-20">UF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.data?.map((market) => (
              <TableRow key={market.id}>
                <TableCell>{market.name}</TableCell>
                <TableCell>{market.state ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {canEdit && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await attempt(
              () => api.media.saveMarket(null, { name, state: state || null, abbreviation: null, active: true }),
              'Praça criada.',
            );
            if (ok) {
              setName('');
              setState('');
              await markets.reload();
            }
          }}
        >
          <Input
            className="w-64"
            placeholder="Cidade ou região"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="w-20"
            placeholder="UF"
            maxLength={2}
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Plus /> Adicionar
          </Button>
        </form>
      )}
    </div>
  );
}

function Programs({ canEdit }: { canEdit: boolean }) {
  const networks = useResource(() => api.media.networks(), []);
  const programs = useResource(() => api.media.programs(), []);
  const [form, setForm] = useState({
    name: '',
    mnemonic: '',
    networkId: '',
    mediaType: 'TV' as 'TV' | 'RADIO',
    startTime: '',
    endTime: '',
    airingDays: [1, 2, 3, 4, 5],
  });
  const network = (id: string) => networks.data?.find((item) => item.id === id)?.name ?? '—';
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Programa</TableHead>
              <TableHead className="w-24">Mnemônico</TableHead>
              <TableHead>Rede</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead>Vai ao ar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {programs.data?.map((program) => (
              <TableRow key={program.id}>
                <TableCell>
                  {program.name}
                  {program.startTime && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {program.startTime}–{program.endTime}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono">{program.mnemonic}</TableCell>
                <TableCell>{network(program.networkId)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{program.mediaType === 'TV' ? 'TV' : 'Rádio'}</Badge>
                </TableCell>
                <TableCell className="text-sm">{program.airingDays.map((day) => WEEKDAYS[day]).join(', ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {canEdit && (
        <form
          className="grid gap-3 rounded-lg border p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await attempt(
              () =>
                api.media.saveProgram(null, {
                  ...form,
                  channel: null,
                  startTime: form.startTime || null,
                  endTime: form.endTime || null,
                  active: true,
                }),
              'Programa criado.',
            );
            if (ok) {
              setForm((current) => ({ ...current, name: '', mnemonic: '' }));
              await programs.reload();
            }
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-56"
              placeholder="Nome do programa"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              className="w-28"
              placeholder="Mnemônico"
              required
              value={form.mnemonic}
              onChange={(e) => setForm({ ...form, mnemonic: e.target.value })}
            />
            <Select value={form.networkId} onValueChange={(networkId) => setForm({ ...form, networkId })}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Rede" />
              </SelectTrigger>
              <SelectContent>
                {networks.data?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={form.mediaType}
              onValueChange={(mediaType) => setForm({ ...form, mediaType: mediaType as 'TV' | 'RADIO' })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TV">TV</SelectItem>
                <SelectItem value="RADIO">Rádio</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="time"
              className="w-28"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
            <Input
              type="time"
              className="w-28"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Vai ao ar:</span>
            {WEEKDAYS.map((label, day) => (
              <Label key={day} className="flex items-center gap-1.5 font-normal">
                <Checkbox
                  checked={form.airingDays.includes(day)}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      airingDays: checked ? [...form.airingDays, day] : form.airingDays.filter((item) => item !== day),
                    })
                  }
                />
                {label}
              </Label>
            ))}
            <Button type="submit" variant="outline" className="ml-auto" disabled={!form.networkId}>
              <Plus /> Adicionar programa
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Configurações › Mídia: redes, praças e programas de TV e rádio. */
export default function MediaSettingsPage() {
  const { can } = useAuth();
  const canEdit = can('medias', 6);
  return (
    <>
      <PageHeader
        title="Configurações de mídia"
        description={canEdit ? undefined : 'Só quem tem permissão total em mídia altera estes cadastros.'}
      />
      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Cadastros de mídia</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="networks">
            <TabsList>
              <TabsTrigger value="networks">Redes</TabsTrigger>
              <TabsTrigger value="markets">Praças</TabsTrigger>
              <TabsTrigger value="programs">Programas de TV e rádio</TabsTrigger>
            </TabsList>
            <TabsContent value="networks" className="pt-4">
              <Networks canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="markets" className="pt-4">
              <Markets canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="programs" className="pt-4">
              <Programs canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
