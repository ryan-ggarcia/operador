'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/auth-provider';
import { Loading } from '@/components/common';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/services';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loading />
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (next !== confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.auth.changePassword(current, next);
      await refresh();
      toast.success('Senha alterada.');
      router.replace('/jobs');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Trocar senha</CardTitle>
          <CardDescription>
            {user.mustChangePassword
              ? 'Sua senha é provisória. Escolha uma senha nova para continuar.'
              : 'Ao trocar, as outras sessões abertas são encerradas.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="current">Senha atual</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="next">Nova senha</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirme a nova senha</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              {!user.mustChangePassword && (
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Voltar
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Salvar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
