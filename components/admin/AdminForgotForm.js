'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * AdminForgotForm — request a reset link.
 *
 * The server always answers the same way, so this component does too: after a
 * submit it shows the generic "if that address is on file" message and nothing
 * that could confirm whether an account exists.
 */
export default function AdminForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Could not send the reset email.');
        return;
      }

      setSent(true);
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-10 space-y-5 text-center">
        <p className="border border-bbLine bg-bbInk/5 p-4 text-sm leading-relaxed text-bbInk/70">
          If that address is on file, a reset link is on its way. It expires in 30 minutes.
        </p>
        <Link href="/admin/login" className="bb-btn-outline block w-full text-center">
          Back To Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-5">
      <label className="block">
        <span className="bb-label">Email</span>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="bb-input"
        />
        <span className="mt-2 block text-xs text-bbInk/40">
          The sign-in address, or any verified recovery address.
        </span>
      </label>

      {error && (
        <p role="alert" className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="bb-btn-solid w-full disabled:opacity-50">
        {submitting ? 'Sending…' : 'Send Reset Link'}
      </button>

      <p className="text-center text-xs text-bbInk/45">
        <Link href="/admin/login" className="bb-link">
          Back To Sign In
        </Link>
      </p>
    </form>
  );
}
