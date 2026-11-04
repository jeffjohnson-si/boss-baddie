'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * LoginForm — email address, then an emailed six-digit code. No password.
 *
 *   step 1  email  -> POST /api/account/login/request
 *   step 2  code   -> POST /api/account/login/verify
 *
 * The request endpoint answers the same way whether or not the address has an
 * account, so the page never confirms who shops here. The code step is where a
 * wrong or unknown address becomes visible.
 *
 * `next` is treated as untrusted: only a site-relative path starting with a
 * single "/" is followed.
 */

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account';
}

const CODE_LENGTH = 6;

export default function LoginForm({ next = '/account' }) {
  const router = useRouter();

  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(null); // { email, devCode }
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState([]);
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestCode(event) {
    event?.preventDefault();
    setErrors([]);
    setNotice('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/account/login/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Could not send a code. Check your connection and try again.']);
        return;
      }

      setPending(data);
      setStep('code');
      setCode('');
      setCooldown(data.resendAfter ?? 60);
    } catch {
      setErrors(['Could not reach the server. Check your connection and try again.']);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setErrors([]);
    setNotice('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/account/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pending?.email ?? email, code }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['That code could not be checked. Try again.']);
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

  async function resend() {
    if (cooldown > 0 || submitting) return;
    setErrors([]);
    setNotice('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/account/login/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pending?.email ?? email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Could not send another code.']);
        return;
      }

      setPending((current) => ({ ...current, devCode: data.devCode }));
      setCooldown(data.resendAfter ?? 60);
      setNotice('A new code is on its way.');
    } catch {
      setErrors(['Could not reach the server.']);
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Step 2: the code ---------------- */
  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} noValidate className="mt-8 space-y-5">
        <div className="border border-bbRose/25 bg-bbRose/[0.06] p-4">
          <p className="text-sm leading-relaxed text-bbInk/75">
            If <strong className="text-bbInk">{pending?.email ?? 'that address'}</strong> has an
            account, a {CODE_LENGTH}-digit code is on its way. Enter it below to sign in.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-bbInk/45">
            It expires in 10 minutes. No password is needed. Check spam if it has not arrived.
          </p>
          {pending?.devCode && (
            <p className="mt-3 border-t border-bbRose/20 pt-3 text-xs text-bbGold">
              Development mode — the code is <span className="font-mono">{pending.devCode}</span>.
              A real email sends as soon as Brevo is configured.
            </p>
          )}
        </div>

        <label className="block">
          <span className="bb-label">Verification code</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            required
            autoFocus
            className="bb-input text-center font-mono text-2xl tracking-[0.5em]"
            placeholder="000000"
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

        {notice && (
          <p role="status" className="text-sm text-bbBlush">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || code.length !== CODE_LENGTH}
          className="bb-btn-solid w-full disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="flex items-center justify-between pt-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setErrors([]);
              setNotice('');
            }}
            className="text-bbInk/50 underline-offset-4 hover:text-bbInk hover:underline"
          >
            Change email
          </button>

          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || submitting}
            className="text-bbRose underline-offset-4 hover:underline disabled:text-bbInk/30 disabled:no-underline"
          >
            {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send a new code'}
          </button>
        </div>

        <p className="pt-2 text-center text-sm text-bbInk/55">
          New here?{' '}
          <Link
            href={`/account/register?next=${encodeURIComponent(safeNext(next))}`}
            className="text-bbRose underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </form>
    );
  }

  /* ---------------- Step 1: email ---------------- */
  return (
    <form onSubmit={requestCode} noValidate className="mt-8 space-y-5">
      <label className="block">
        <span className="bb-label">Email address</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoFocus
          className="bb-input"
          placeholder="you@example.com"
        />
        <span className="mt-2 block text-xs leading-relaxed text-bbInk/40">
          We email a six-digit code. There is no password to remember.
        </span>
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
        {submitting ? 'Sending code…' : 'Send My Code'}
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
    </form>
  );
}
