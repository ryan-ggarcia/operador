'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { ErrorMessage } from '@/components/common';

/** Cadastros é só do administrador (a API também recusa as alterações). */
export default function PartiesLayout({ children }: { children: React.ReactNode }) {
  const { permissions } = useAuth();
  if (!permissions?.flags.administrator) {
    return <ErrorMessage error={new Error('Só administradores acessam os cadastros.')} />;
  }
  return children;
}
