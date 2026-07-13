import Link from 'next/link';
import { ForgotPasswordForm } from '../(auth)/auth-forms';

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <div className="w-full">
        <ForgotPasswordForm />
        <p className="mt-4 text-sm text-slate-400">
          Remembered it?{' '}
          <Link className="text-brand" href="/login">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
