import Link from 'next/link';
import { LoginForm } from '../(auth)/auth-forms';

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <div className="w-full">
        <LoginForm />
        <div className="mt-4 flex justify-between text-sm text-slate-400">
          <Link className="hover:text-slate-100" href="/forgot-password">
            Forgot password
          </Link>
          <Link className="hover:text-slate-100" href="/register">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
