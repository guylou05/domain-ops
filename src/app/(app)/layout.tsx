import { AppShell } from '@/components/shell';
import { getWorkspaceNavigation } from '@/lib/server/workspace-context';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const workspaceNavigation = await getWorkspaceNavigation();
  return <AppShell workspaceNavigation={workspaceNavigation}>{children}</AppShell>;
}
