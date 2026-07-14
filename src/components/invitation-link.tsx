'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function InvitationLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/invite/${token}`;

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3">
      <p className="min-w-0 flex-1 truncate text-sm text-emerald-100">{path}</p>
      <button
        aria-label="Copy invitation link"
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-emerald-300/20 text-emerald-200 hover:bg-emerald-300/10"
        onClick={copyLink}
        title="Copy invitation link"
        type="button"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}
