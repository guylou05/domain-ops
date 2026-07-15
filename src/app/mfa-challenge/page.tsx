import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { MfaChallengeForm } from './challenge-form';
import { getActiveAuthSession } from '@/lib/server/auth-sessions';

export const dynamic = 'force-dynamic';

export default async function MfaChallengePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.authSessionId) redirect('/login');
  const trackedSession = await getActiveAuthSession(session.authSessionId, session.user.id);
  if (!trackedSession) redirect('/login?session=expired');
  if (trackedSession.mfaAuthenticatedAt) redirect('/overview');
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <section className="card w-full">
        <p className="text-sm font-semibold text-brand">Two-factor authentication</p>
        <h1 className="mt-3 text-3xl font-bold">Verify your sign-in</h1>
        <p className="mt-3 text-slate-300">Enter a code from your authenticator app or use one recovery code.</p>
        <MfaChallengeForm />
      </section>
    </main>
  );
}
