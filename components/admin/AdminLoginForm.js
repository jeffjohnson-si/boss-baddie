'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * AdminLoginForm — Patricia's email and password.
 *
 * Kept as a client component so the page around it can stay a server component:
 * that is what lets the page decide whether to offer the development shortcut
 * without shipping a flag to every browser.
 *
 * The error message is intentionally vague — it never says whether the email or
 * the password was the wrong one.
 */
export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Those details do not match.');
        return;
      }

      // refresh() re-runs the server component check on /admin with the new cookie.
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-5">
      <label className="block">
        <span className="bb-label">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="username"
          className="bb-input"
        />
      </label>

      <label className="block">
        <span className="bb-label">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="bb-input"
        />
      </label>

      {error && (
        <p role="alert" className="border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="bb-btn-solid w-full disabled:opacity-50">
        {submitting ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
