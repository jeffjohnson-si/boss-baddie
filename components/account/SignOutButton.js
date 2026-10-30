'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * SignOutButton — clears the customer session cookie and returns her to the shop.
 *
 * The cookie is httpOnly, so only the server can clear it; this asks the API and
 * then refreshes the router so the header stops showing her name.
 */
export default function SignOutButton({ className = 'bb-btn-outline w-full sm:w-auto' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/account/session', { method: 'DELETE' });
    } catch {
      // Even if the request fails, sending her home is the honest move: the page
      // she lands on will show the truth about whether she is still signed in.
    } finally {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className={`${className} disabled:opacity-50`}>
      {busy ? 'Signing out…' : 'Sign Out'}
    </button>
  );
}
