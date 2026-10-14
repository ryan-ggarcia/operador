import { AppShell } from '@/components/app-shell';
import { ReferenceDataProvider } from '@/components/reference-data';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <ReferenceDataProvider>{children}</ReferenceDataProvider>
    </AppShell>
  );
}
