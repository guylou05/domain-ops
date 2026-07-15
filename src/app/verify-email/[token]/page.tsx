import Link from 'next/link';
import { getEmailVerificationView } from '@/lib/server/email-verification';
import { confirmEmailVerification } from './actions';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const [{ token }, feedback] = await Promise.all([params, searchParams]);
  const verification = await getEmailVerificationView(token);
  const completed = verification?.verified;

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <section className="card w-full">
        <p className="text-sm font-semibold text-brand">Account security</p>
        {completed ? (
          <>
            <h1 className="mt-3 text-3xl font-bold">Email verified</h1>
            <p className="mt-3 text-slate-300">Your email address is verified. Security-sensitive workspace actions are now available.</p>
            <Link className="mt-6 inline-block text-sm font-semibold text-brand" href="/settings">Continue to settings</Link>
          </>
        ) : !verification?.usable ? (
          <>
            <h1 className="mt-3 text-3xl font-bold">Verification link unavailable</h1>
            <p className="mt-3 text-slate-300">This link is invalid, expired, or already used.</p>
            <Link className="mt-6 inline-block text-sm font-semibold text-brand" href="/settings">Request another link in settings</Link>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-bold">Verify your email</h1>
            <p className="mt-3 text-slate-300">Confirm that {verification.email} belongs to you. This link can be used once.</p>
            {feedback?.error ? <p className="mt-4 rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">This verification link could not be confirmed.</p> : null}
            <form action={confirmEmailVerification} className="mt-6">
              <input name="token" type="hidden" value={token} />
              <button className="w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white">Confirm email</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
