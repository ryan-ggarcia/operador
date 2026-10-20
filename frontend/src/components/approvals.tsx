'use client';

import { Check, Loader2, Stamp, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Attachments, type AttachmentExtensions } from '@/components/attachments';
import { UserAvatar } from '@/components/common';
import { useAuth } from '@/components/auth/auth-provider';
import { useReferenceData } from '@/components/reference-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import { formatDateTime, formatDeadline } from '@/lib/format';
import { api } from '@/services';
import {
  APPROVAL_SITUATION_LABEL,
  type Approval,
  type ApprovalDocType,
  type ApprovalSituation,
} from '@/services/approvals.service';
import type { StoredFile } from '@/services/files.service';
import type { UserRef } from '@/services/types';

const SITUATION_VARIANT: Record<ApprovalSituation, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  OPEN: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELED: 'outline',
};

function RequestDialog({
  file,
  docType,
  docId,
  involved,
  onClose,
  onRequested,
}: {
  file: StoredFile;
  docType: ApprovalDocType;
  docId: string;
  involved: UserRef[];
  onClose: () => void;
  onRequested: () => void;
}) {
  const { user } = useAuth();
  const candidates = involved.filter((person) => person.id !== user?.id);
  const [selected, setSelected] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.approvals.request({
        docType,
        docId,
        fileId: file.id,
        approverIds: selected,
        deadline: deadline || null,
      });
      toast.success('Aprovação solicitada.');
      onRequested();
      onClose();
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar aprovação</DialogTitle>
          <DialogDescription>{file.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Aprovar com</Label>
            {candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">Inclua envolvidos no documento para pedir aprovação.</p>
            )}
            {candidates.map((person) => (
              <label key={person.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(person.id)}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked ? [...current, person.id] : current.filter((id) => id !== person.id),
                    )
                  }
                />
                <UserAvatar user={person} size="sm" /> {person.name}
              </label>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="approval-deadline">Prazo</Label>
            <Input id="approval-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || selected.length === 0}>
              {saving && <Loader2 className="animate-spin" />}
              Solicitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Imagem da peça com os marcadores; clicar marca um ponto. */
function MarkedImage({ approval, onChange }: { approval: Approval; onChange: (approval: Approval) => void }) {
  const url = useResource(() => api.files.url(approval.fileId, true), [approval.fileId]);
  const { user: me } = useAuth();
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState('');

  async function save() {
    if (!draft) return;
    try {
      onChange(await api.approvals.addMarker(approval.id, { ...draft, text }));
      setDraft(null);
      setText('');
    } catch (caught) {
      toast.error((caught as Error).message);
    }
  }

  if (!url.data) return <p className="text-sm text-muted-foreground">Carregando imagem…</p>;
  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-md border bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do storage */}
        <img
          src={url.data.url}
          alt={approval.file?.name ?? 'Peça'}
          className={`block w-full ${approval.can.mark ? 'cursor-crosshair' : ''}`}
          onClick={(event) => {
            if (!approval.can.mark) return;
            const box = event.currentTarget.getBoundingClientRect();
            setDraft({
              x: Math.round(((event.clientX - box.left) / box.width) * 10000) / 100,
              y: Math.round(((event.clientY - box.top) / box.height) * 10000) / 100,
            });
          }}
        />
        {approval.markers.map((marker, index) => (
          <span
            key={marker.id}
            title={marker.html}
            className="absolute grid size-6 -translate-1/2 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow"
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
          >
            {index + 1}
          </span>
        ))}
        {draft && (
          <span
            className="absolute size-6 -translate-1/2 rounded-full border-2 border-primary bg-background/70"
            style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
          />
        )}
      </div>
      {draft && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            autoFocus
            placeholder="Comentário sobre este ponto"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!text.trim()}>
            Marcar
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
            Cancelar
          </Button>
        </form>
      )}
      {approval.markers.length > 0 && (
        <ol className="grid gap-1.5 text-sm">
          {approval.markers.map((marker, index) => (
            <li key={marker.id} className="flex items-start gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="flex-1">{marker.html}</span>
              {marker.authorId === me?.id && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Apagar marcador"
                  onClick={() =>
                    void api.approvals
                      .removeMarker(approval.id, marker.id)
                      .then(onChange, (caught: Error) => toast.error(caught.message))
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Detalhe do pedido: peça, votos, marcadores e as ações de quem pode. */
function ApprovalDialog({
  approval,
  onClose,
  onChange,
}: {
  approval: Approval;
  onClose: () => void;
  onChange: (approval: Approval) => void;
}) {
  const { user } = useReferenceData();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const isImage = approval.file?.mimeType.startsWith('image/');

  async function run(action: () => Promise<Approval>, success: string) {
    setBusy(true);
    try {
      onChange(await action());
      toast.success(success);
      setRejecting(false);
    } catch (caught) {
      toast.error((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {approval.file?.name ?? 'Arquivo excluído'}
            <Badge variant={SITUATION_VARIANT[approval.situation]}>
              {APPROVAL_SITUATION_LABEL[approval.situation]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Pedido por {user(approval.requesterId)?.name ?? '—'} em {formatDateTime(approval.createdAt)}
            {approval.deadline && ` · prazo ${formatDeadline(approval.deadline, false)}`}
          </DialogDescription>
        </DialogHeader>

        {isImage && <MarkedImage approval={approval} onChange={onChange} />}

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Aprovadores</h3>
          {approval.approverIds.map((id) => {
            const vote = approval.votes.find((current) => current.userId === id);
            return (
              <div key={id} className="flex items-start gap-2 text-sm">
                <UserAvatar user={user(id) ?? null} size="sm" />
                <div className="flex-1">
                  {user(id)?.name ?? '—'}
                  {vote?.reason && <p className="text-muted-foreground">Motivo: {vote.reason}</p>}
                </div>
                {vote ? (
                  <Badge variant={vote.decision === 'APPROVE' ? 'default' : 'destructive'}>
                    {vote.decision === 'APPROVE' ? 'Aprovou' : 'Reprovou'}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Aguardando</span>
                )}
              </div>
            );
          })}
        </div>

        {rejecting && (
          <div className="grid gap-2">
            <Label htmlFor="reject-reason">Motivo da reprovação</Label>
            <Textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}

        {(approval.can.vote || approval.can.cancel) && (
          <DialogFooter className="gap-2">
            {approval.can.cancel && !rejecting && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void run(() => api.approvals.cancel(approval.id), 'Pedido cancelado.')}
              >
                Cancelar pedido
              </Button>
            )}
            {approval.can.vote &&
              (rejecting ? (
                <>
                  <Button variant="ghost" onClick={() => setRejecting(false)}>
                    Voltar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy || !reason.trim()}
                    onClick={() => void run(() => api.approvals.vote(approval.id, 'REJECT', reason), 'Peça reprovada.')}
                  >
                    <X /> Reprovar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                    <X /> Reprovar
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => void run(() => api.approvals.vote(approval.id, 'APPROVE'), 'Peça aprovada.')}
                  >
                    <Check /> Aprovar
                  </Button>
                </>
              ))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Envolvidos sem repetir (responsável, solicitante e membros). */
export function involvedOf(people: (UserRef | null | undefined)[]): UserRef[] {
  const seen = new Map<string, UserRef>();
  for (const person of people) if (person) seen.set(person.id, person);
  return [...seen.values()];
}

/** Anexos de projeto ou job com a aprovação de peças. */
export function ApprovalAttachments({
  docType,
  docId,
  involved,
}: {
  docType: ApprovalDocType;
  docId: string;
  involved: UserRef[];
}) {
  const approvals = useResource(() => api.approvals.list(docType, docId), [docType, docId]);
  const [requesting, setRequesting] = useState<StoredFile | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // A lista vem do mais novo para o mais antigo: o primeiro é o pedido atual.
  const latest = (file: StoredFile) => approvals.data?.find((approval) => approval.fileId === file.id);
  const opened = approvals.data?.find((approval) => approval.id === openId) ?? null;

  const extensions: AttachmentExtensions = {
    extra: (file) => {
      const approval = latest(file);
      if (!approval) return null;
      return (
        <button type="button" className="mt-1" onClick={() => setOpenId(approval.id)}>
          <Badge variant={SITUATION_VARIANT[approval.situation]}>{APPROVAL_SITUATION_LABEL[approval.situation]}</Badge>
        </button>
      );
    },
    actions: (file) =>
      file.canChange && latest(file)?.situation !== 'OPEN' ? (
        <Button variant="ghost" size="icon-sm" title="Solicitar aprovação" onClick={() => setRequesting(file)}>
          <Stamp />
        </Button>
      ) : null,
  };

  return (
    <>
      <Attachments ownerType={docType === 'JOB' ? 'job' : 'project'} ownerId={docId} extensions={extensions} />
      {requesting && (
        <RequestDialog
          file={requesting}
          docType={docType}
          docId={docId}
          involved={involved}
          onClose={() => setRequesting(null)}
          onRequested={() => void approvals.reload()}
        />
      )}
      {opened && (
        <ApprovalDialog
          approval={opened}
          onClose={() => setOpenId(null)}
          onChange={(updated) =>
            approvals.setData(
              (approvals.data ?? []).map((approval) => (approval.id === updated.id ? updated : approval)),
            )
          }
        />
      )}
    </>
  );
}

/** Painel "aprovações para você" (some quando não há nada pendente). */
export function PendingApprovals() {
  const pending = useResource(() => api.approvals.pending(), []);
  const { user } = useReferenceData();
  if (!pending.data?.length) return null;
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stamp className="size-4" /> Aprovações para você ({pending.data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {pending.data.map((approval) => (
            <li key={approval.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <Link href={approval.document.link} className="font-medium hover:underline">
                {approval.file?.name ?? 'Arquivo'}
              </Link>
              <span className="text-muted-foreground">
                em {approval.document.label} · pedido por {user(approval.requesterId)?.name ?? '—'}
              </span>
              {approval.deadline && (
                <span className="ml-auto text-xs text-muted-foreground">
                  prazo {formatDeadline(approval.deadline, false)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
