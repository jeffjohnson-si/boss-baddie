'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Sign out of the account — which is also the community. There is one session
 * cookie now, so the same call clears the shop and the room, and the account
 * page uses the same endpoint.
 */
export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/account/session', { method: 'DELETE' });
      router.push('/community');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className="bb-link disabled:opacity-50">
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
