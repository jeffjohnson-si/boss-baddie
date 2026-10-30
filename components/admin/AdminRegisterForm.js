'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * AdminRegisterForm — the one-time owner account.
 *
 * The page only renders this while admin_users is empty; the API enforces the
 * same rule atomically. Registration signs her in immediately.
 */
export default function AdminRegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
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
      const response = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? [data.error ?? 'Could not create the account.']);
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

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-5">
      <label className="block">
        <span className="bb-label">Your name</span>
        <input
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          required
          className="bb-input"
        />
      </label>

      <label className="block">
        <span className="bb-label">Email</span>
        <input
          type="email"
          autoComplete="username"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          required
          className="bb-input"
        />
        <span className="mt-2 block text-xs text-bbInk/40">
          Password-reset links go here. Use an address you can open.
        </span>
      </label>

      <label className="block">
        <span className="bb-label">Password</span>
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
        <span className="bb-label">Confirm password</span>
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
        {submitting ? 'Creating account…' : 'Create Owner Account'}
      </button>

      <p className="text-center text-xs text-bbInk/45">
        Already have the account?{' '}
        <Link href="/admin/login" className="bb-link">
          Sign in
        </Link>
      </p>
    </form>
  );
}
