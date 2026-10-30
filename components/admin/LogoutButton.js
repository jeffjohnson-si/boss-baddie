'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * LogoutButton — clears the admin session cookie.
 *
 * The cookie is httpOnly, so JavaScript cannot delete it directly; only the
 * server can. Hence the DELETE request rather than a document.cookie assignment.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await fetch('/api/admin/session', { method: 'DELETE' });
    } finally {
      // Navigate regardless: if the request failed the session is still there,
      // but the operator has clearly finished and should not be left staring at
      // customer data.
      router.push('/admin/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="min-h-[44px] border border-bbLine px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-bbInk/70 transition-colors hover:border-bbRose hover:text-bbRose disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
