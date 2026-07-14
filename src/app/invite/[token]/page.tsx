import Link from 'next/link';
import { getInvitationView } from '@/lib/server/invitations';
import { InviteAcceptanceForm } from './invite-form';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationView(token);

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <section className="card w-full">
        <p className="text-sm font-semibold text-brand">Workspace invitation</p>
        {!invitation || !invitation.usable ? (
          <>
            <h1 className="mt-3 text-3xl font-bold">Invitation unavailable</h1>
            <p className="mt-3 text-slate-300">This link is invalid, expired, revoked, or has already been used.</p>
            <Link className="mt-6 inline-block text-sm font-semibold text-brand" href="/login">
              Return to login
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-bold">Join {invitation.workspaceName}</h1>
            <p className="mt-3 text-slate-300">
              Accept access as {invitation.role.toLowerCase()}. This link expires {invitation.expiresAt.toLocaleDateString('en-US')}.
            </p>
            <InviteAcceptanceForm email={invitation.email} token={token} />
          </>
        )}
      </section>
    </main>
  );
}
