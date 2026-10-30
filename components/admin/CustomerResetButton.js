'use client';

import { useState } from 'react';

/**
 * CustomerResetButton — Patricia issues a temporary password for a customer.
 *
 * The password is returned once by the API and displayed only in this panel. It
 * is not emailed or texted automatically: Patricia copies it and sends it
 * privately, which is how her customers already communicate with her.
 */
export default function CustomerResetButton({ customerId, customerName }) {
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function reset() {
    const confirmed = window.confirm(
      `Reset the password for ${customerName}? All her current sessions will be signed out.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError('');
    setPassword('');
    setCopied(false);

    try {
      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(customerId)}/password-reset`,
        { method: 'POST' },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Could not reset the password.');
        return;
      }

      setPassword(data.password);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <button
        type="button"
        onClick={reset}
        disabled={busy}
        className="bb-btn-outline text-xs disabled:opacity-50"
      >
        {busy ? 'Resetting…' : 'Reset password'}
      </button>

      {error && (
        <p role="alert" className="mt-2 max-w-xs text-xs text-red-300">
          {error}
        </p>
      )}

      {password && (
        <div className="mt-3 max-w-xs border border-bbGold/30 bg-bbGold/[0.06] p-3 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bbGold">
            Temporary password
          </p>
          <code className="mt-2 block break-all bg-black/40 p-2 text-sm text-bbInk">
            {password}
          </code>
          <button type="button" onClick={copy} className="bb-btn-outline mt-2 w-full text-xs">
            {copied ? 'Copied' : 'Copy password'}
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-bbInk/50">
            Shown once. Send it privately; she should change it after signing in.
          </p>
        </div>
      )}
    </div>
  );
}
