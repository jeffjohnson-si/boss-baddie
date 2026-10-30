'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * LoginForm — phone number + password.
 *
 * The phone number is the handle, so there is one field and no "was it the email?"
 * confusion. The API answers "those details do not match" for both a wrong number
 * and a wrong password; repeating that vagueness here is the point.
 *
 * `next` is where to go afterwards. It comes from the URL, so it is treated as
 * untrusted: only a site-relative path starting with a single "/" is followed.
 */

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account';
}

export default function LoginForm({ next = '/account' }) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);

    try {
      const response = await fetch('/api/account/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Could not sign in. Check your connection and try again.']);
        return;
      }

      router.push(safeNext(next));
      router.refresh();
    } catch {
      setErrors(['Could not reach the server. Check your connection and try again.']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
      <label className="block">
        <span className="bb-label">Phone number</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          className="bb-input"
          placeholder="+677 740 0000"
        />
      </label>

      <label className="block">
        <span className="bb-label">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="bb-input"
        />
      </label>

      {errors.length > 0 && (
        <div role="alert" className="border border-bbRose/50 bg-bbRose/[0.07] p-4">
          <ul className="list-inside list-disc space-y-1 text-sm text-bbInk/80">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" disabled={submitting} className="bb-btn-solid w-full disabled:opacity-50">
        {submitting ? 'Signing in…' : 'Sign In'}
      </button>

      <p className="pt-2 text-center text-sm text-bbInk/55">
        New here?{' '}
        <Link
          href={`/account/register?next=${encodeURIComponent(safeNext(next))}`}
          className="text-bbRose underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>

      <p className="text-center text-xs leading-relaxed text-bbInk/35">
        Forgotten your password? Message us on WhatsApp and Patricia will reset it for you.
      </p>
    </form>
  );
}
