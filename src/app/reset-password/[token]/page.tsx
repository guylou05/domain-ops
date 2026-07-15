import Link from 'next/link';
import { getPasswordResetView } from '@/lib/server/password-recovery';
import { ResetPasswordForm } from './reset-form';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await getPasswordResetView(token);
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <section className="card w-full">
        <p className="text-sm font-semibold text-brand">Account recovery</p>
        {!reset?.usable ? (
          <>
            <h1 className="mt-3 text-3xl font-bold">Reset link unavailable</h1>
            <p className="mt-3 text-slate-300">This link is invalid, expired, or already used.</p>
            <Link className="mt-6 inline-block text-sm font-semibold text-brand" href="/forgot-password">Request another link</Link>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-bold">Choose a new password</h1>
            <p className="mt-3 text-slate-300">Reset access for {reset.email}. This link can be used once.</p>
            <ResetPasswordForm token={token} />
          </>
        )}
      </section>
    </main>
  );
}
