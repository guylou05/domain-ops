import Link from 'next/link';
import { RegisterForm } from '../(auth)/auth-forms';

export default function RegisterPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <div className="w-full">
        <RegisterForm />
        <p className="mt-4 text-sm text-slate-400">
          Already registered?{' '}
          <Link className="text-brand" href="/login">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
