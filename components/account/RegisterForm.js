'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * RegisterForm — create a shop account, in two steps.
 *
 *   1. Details (name, email, phone, location) -> POST /api/account/register,
 *      which emails a six-digit code. No account exists yet at this point.
 *   2. The code -> POST /api/account/verify, which creates the account and signs
 *      her in.
 *
 * There is no password. The EMAIL ADDRESS is the login handle, and every new
 * device is signed in with another emailed code. The phone number is collected
 * only so Patricia can reach her about collection.
 *
 * The resend button counts down the same 60 seconds the server enforces, so the
 * interface never promises something the API will refuse.
 */

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account';
}

const CODE_LENGTH = 6;

export default function RegisterForm({ next = '/account', defaultEmail = '' }) {
  const router = useRouter();

  const [step, setStep] = useState('details'); // 'details' | 'code'
  const [form, setForm] = useState({
    name: '',
    email: defaultEmail,
    phone: '',
    location: '',
  });
  const [pending, setPending] = useState(null); // { email, devCode }
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState('');

  // One shared countdown for "send again".
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  async function submitDetails(event) {
    event.preventDefault();
    setErrors([]);
    setNotice('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Could not create the account. Check your connection and try again.']);
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

  async function submitCode(event) {
    event.preventDefault();
    setErrors([]);
    setNotice('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/account/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pending?.email, code }),
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
      const response = await fetch('/api/account/verify/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pending?.email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Could not send another code.']);
        return;
      }

      setPending((current) => ({ ...current, devCode: data.devCode }));
      setCooldown(data.resendAfter ?? 60);
      setNotice('New code sent.');
    } catch {
      setErrors(['Could not reach the server.']);
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Step 2: the code ---------------- */
  if (step === 'code') {
    return (
      <form onSubmit={submitCode} noValidate className="mt-8 space-y-5">
        <div className="border border-bbRose/25 bg-bbRose/[0.06] p-4">
          <p className="text-sm leading-relaxed text-bbInk/75">
            We emailed a {CODE_LENGTH}-digit code to{' '}
            <strong className="text-bbInk">{pending?.email}</strong>. Enter it below to finish
            creating your account.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-bbInk/45">
            It expires in 10 minutes. Check your spam folder if it has not arrived.
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
          {submitting ? 'Checking…' : 'Verify And Create Account'}
        </button>

        <div className="flex items-center justify-between pt-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep('details');
              setErrors([]);
              setNotice('');
            }}
            className="text-bbInk/50 underline-offset-4 hover:text-bbInk hover:underline"
          >
            Change details
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
      </form>
    );
  }

  /* ---------------- Step 1: details ---------------- */
  return (
    <form onSubmit={submitDetails} noValidate className="mt-8 space-y-5">
      <label className="block">
        <span className="bb-label">Your name</span>
        <input
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={field('name').onChange}
          required
          className="bb-input"
          placeholder="Patricia Sogavare"
        />
      </label>

      <label className="block">
        <span className="bb-label">Email address</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={field('email').onChange}
          required
          className="bb-input"
          placeholder="you@example.com"
        />
        <span className="mt-2 block text-xs leading-relaxed text-bbInk/40">
          We email a code to this address to confirm it is yours. It is also how you sign in — no
          password to remember.
        </span>
      </label>

      <label className="block">
        <span className="bb-label">Phone number</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={field('phone').onChange}
          required
          className="bb-input"
          placeholder="+677 740 0000"
        />
        <span className="mt-2 block text-xs leading-relaxed text-bbInk/40">
          So Patricia can reach you about collection. We never text a code to it.
        </span>
      </label>

      <label className="block">
        <span className="bb-label">Village, suburb or province (optional)</span>
        <input
          type="text"
          value={form.location}
          onChange={field('location').onChange}
          className="bb-input"
          placeholder="e.g. Honiara — Ranadi, or Gizo"
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
        {submitting ? 'Sending your code…' : 'Send My Code'}
      </button>

      <p className="pt-2 text-center text-sm text-bbInk/55">
        Already have an account?{' '}
        <Link
          href={`/account/login?next=${encodeURIComponent(safeNext(next))}`}
          className="text-bbRose underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
