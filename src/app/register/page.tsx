import Link from 'next/link';
import { RegisterForm } from '../(auth)/auth-forms';
import { getPublicPlans } from '@/lib/server/public-plans';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({ searchParams }: { searchParams?: Promise<{ plan?: string }> }) {
  const [plans, query] = await Promise.all([getPublicPlans(), searchParams]);
  const planNames = plans.map((plan) => plan.name);
  const requestedPlan = query?.plan;
  const selectedPlan = requestedPlan && planNames.includes(requestedPlan) ? requestedPlan : planNames[0] ?? 'Professional';

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center p-8">
      <div className="w-full">
        <RegisterForm plans={planNames.length > 0 ? planNames : ['Professional']} selectedPlan={selectedPlan} />
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
