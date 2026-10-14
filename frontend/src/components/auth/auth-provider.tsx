'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, http } from '@/services';
import type { PermissionModule, UserPermissions, UserSummary } from '@/services/types';

interface AuthState {
  user: UserSummary | null;
  permissions: UserPermissions | null;
  loading: boolean;
  /** Carrega o usuário e as permissões de novo (ex.: depois do login). */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  can: (module: PermissionModule, minimum?: number) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

type Me = { user: UserSummary; permissions: UserPermissions };

/** Usuário e permissões da sessão guardada, ou null sem sessão válida. */
async function loadSession(): Promise<Me | null> {
  if (!api.auth.hasSession()) return null;
  return api.auth.me().catch(() => null);
}

const PUBLIC_PATHS = ['/login'];
const CHANGE_PASSWORD_PATH = '/trocar-senha';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((me: Me | null) => {
    setUser(me?.user ?? null);
    setPermissions(me?.permissions ?? null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => apply(await loadSession()), [apply]);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
    setPermissions(null);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    http.onSessionExpired = () => {
      setUser(null);
      setPermissions(null);
      router.replace('/login');
    };
    let active = true;
    loadSession().then((me) => {
      if (active) apply(me);
    });
    return () => {
      active = false;
    };
  }, [apply, router]);

  useEffect(() => {
    if (loading) return;
    if (!user && !PUBLIC_PATHS.includes(pathname)) router.replace('/login');
    // Senha provisória: o primeiro acesso passa pela troca de senha.
    else if (user?.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH);
    }
  }, [loading, user, pathname, router]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      permissions,
      loading,
      refresh,
      logout,
      can: (module, minimum = 1) => (permissions?.modules[module] ?? 0) >= minimum,
    }),
    [user, permissions, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
