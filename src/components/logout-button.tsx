'use client';

import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button
      className="w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm font-semibold text-slate-200 hover:bg-white/10"
      onClick={() => signOut({ callbackUrl: '/login' })}
      type="button"
    >
      Log out
    </button>
  );
}
