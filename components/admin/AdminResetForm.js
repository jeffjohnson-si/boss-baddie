'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * AdminResetForm — choose a new password from a one-time link.
 *
 * On success the server sets a fresh session cookie (the reset bumped
 * session_version), so this signs her straight into the dashboard.
 */
export default function AdminResetForm({ token }) {
  const router = useRouter();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? [data.error ?? 'Could not reset the password.']);
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setErrors(['Could not reach the server. Check your connection.']);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-10 space-y-5 text-center">
        <p className="border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
          This reset link is missing its token.
        </p>
        <Link href="/admin/forgot" className="bb-btn-solid block w-full text-center">
          Request A New Link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-5">
      <label className="block">
        <span className="bb-label">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          required
          className="bb-input"
        />
        <span className="mt-2 block text-xs text-bbInk/40">At least 12 characters.</span>
      </label>

      <label className="block">
        <span className="bb-label">Confirm new password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={form.confirmPassword}
          onChange={(event) => update('confirmPassword', event.target.value)}
          required
          className="bb-input"
        />
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <button type="submit" disabled={submitting} className="bb-btn-solid w-full disabled:opacity-50">
        {submitting ? 'Saving…' : 'Save New Password'}
      </button>

      <p className="text-center text-xs text-bbInk/45">
        <Link href="/admin/forgot" className="bb-link">
          Request A Different Link
        </Link>
      </p>
    </form>
  );
}
