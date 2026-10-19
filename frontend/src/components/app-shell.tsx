'use client';

import {
  Bell,
  BriefcaseBusiness,
  FolderKanban,
  KeyRound,
  ListTodo,
  LogOut,
  Megaphone,
  Printer,
  Timer,
  Menu,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Loading } from '@/components/common';
import { NotificationPreferencesDialog, NotificationsBell } from '@/components/notifications';
import { ReferenceDataProvider } from '@/components/reference-data';
import { TimerProvider, TimerWidget } from '@/components/timesheet/timer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { initials } from '@/lib/format';
import type { PermissionModule } from '@/services/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  modules?: PermissionModule[];
  administrator?: boolean;
}

const NAV: NavItem[] = [
  { href: '/jobs', label: 'Jobs', icon: ListTodo, modules: ['jobs'] },
  {
    href: '/projetos',
    label: 'Projetos',
    icon: FolderKanban,
    modules: ['projects'],
  },
  { href: '/midia', label: 'Mídia', icon: Megaphone, modules: ['medias'] },
  { href: '/producao', label: 'Produção', icon: Printer, modules: ['productions'] },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet, modules: ['financial'] },
  {
    href: '/timesheet',
    label: 'Timesheet',
    icon: Timer,
    modules: ['jobs', 'medias', 'productions'],
  },
  {
    href: '/cadastros',
    label: 'Cadastros',
    icon: BriefcaseBusiness,
    modules: ['clients', 'suppliers', 'providers', 'vehicles'],
  },
  {
    href: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    administrator: true,
  },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, permissions } = useAuth();
  const items = NAV.filter((item) =>
    item.administrator ? permissions?.flags.administrator : !item.modules || item.modules.some((module) => can(module)),
  );
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60'
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/jobs" className="flex items-center gap-2 px-3 font-heading text-lg font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">o</span>
      operador
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  if (loading || !user || user.mustChangePassword) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loading />
      </div>
    );
  }

  return (
    <ReferenceDataProvider>
      <TimerProvider>
        <div className="flex min-h-screen">
          <aside className="hidden w-60 print:hidden shrink-0 flex-col gap-6 border-r bg-sidebar py-5 md:flex">
            <Brand />
            <div className="px-2">
              <Navigation />
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 print:hidden items-center justify-between gap-2 border-b px-4 md:px-8">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 bg-sidebar p-4">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <div className="mb-6">
                    <Brand />
                  </div>
                  <Navigation onNavigate={() => setMenuOpen(false)} />
                </SheetContent>
              </Sheet>
              <div className="flex-1" />
              <TimerWidget />
              <NotificationsBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm sm:inline">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setPreferencesOpen(true)}>
                    <Bell /> Notificações
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/trocar-senha">
                      <KeyRound /> Trocar senha
                    </Link>
                  </DropdownMenuItem>
                  {user.isOwner && (
                    <DropdownMenuItem asChild>
                      <Link href="/configuracoes">
                        <Users /> Usuários
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void logout()}>
                    <LogOut /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            <NotificationPreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
            <main className="flex-1 px-4 py-6 md:px-8 print:p-0">{children}</main>
          </div>
        </div>
      </TimerProvider>
    </ReferenceDataProvider>
  );
}
