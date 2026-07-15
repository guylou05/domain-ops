import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell';
import { authOptions } from '@/lib/auth';
import { getWorkspaceNavigation } from '@/lib/server/workspace-context';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const workspaceNavigation = await getWorkspaceNavigation();
  return <AppShell workspaceNavigation={workspaceNavigation}>{children}</AppShell>;
}
