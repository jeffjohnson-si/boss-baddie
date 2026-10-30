'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * AdminAccountForm — name, password and recovery addresses.
 *
 * The primary email is read-only: safely changing it needs a confirmation sent to
 * the new address, which is a separate feature.
 *
 * Recovery addresses are added as PENDING and only start receiving reset links
 * after the confirmation email is opened.
 */
export default function AdminAccountForm({ admin, recoveryEmails }) {
  const router = useRouter();

  const [details, setDetails] = useState({ displayName: admin.displayName ?? '' });
  const [detailsState, setDetailsState] = useState({ errors: [], saved: false, busy: false });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });
  const [passwordState, setPasswordState] = useState({ errors: [], saved: false, busy: false });

  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryState, setRecoveryState] = useState({ errors: [], message: '', busy: false });
  const [removing, setRemoving] = useState('');

  async function saveDetails(event) {
    event.preventDefault();
    setDetailsState({ errors: [], saved: false, busy: true });

    try {
      const response = await fetch('/api/admin/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setDetailsState({ errors: data.errors ?? ['Could not save your name.'], saved: false, busy: false });
        return;
      }

      setDetailsState({ errors: [], saved: true, busy: false });
      router.refresh();
    } catch {
      setDetailsState({ errors: ['Could not reach the server.'], saved: false, busy: false });
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setPasswordState({ errors: [], saved: false, busy: true });

    try {
      const response = await fetch('/api/admin/account/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwords),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setPasswordState({
          errors: data.errors ?? [data.error ?? 'Could not change the password.'],
          saved: false,
          busy: false,
        });
        return;
      }

      setPasswords({ currentPassword: '', nextPassword: '', confirmPassword: '' });
      setPasswordState({ errors: [], saved: true, busy: false });
      router.refresh();
    } catch {
      setPasswordState({ errors: ['Could not reach the server.'], saved: false, busy: false });
    }
  }

  async function addRecovery(event) {
    event.preventDefault();
    setRecoveryState({ errors: [], message: '', busy: true });

    try {
      const response = await fetch('/api/admin/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setRecoveryState({
          errors: data.errors ?? [data.error ?? 'Could not add that address.'],
          message: '',
          busy: false,
        });
        return;
      }

      setRecoveryEmail('');
      setRecoveryState({
        errors: [],
        message: `Verification email sent to ${data.email}. Open it to activate the address.`,
        busy: false,
      });
      router.refresh();
    } catch {
      setRecoveryState({ errors: ['Could not reach the server.'], message: '', busy: false });
    }
  }

  async function removeRecovery(id) {
    setRemoving(id);
    try {
      await fetch(`/api/admin/recovery/${encodeURIComponent(id)}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setRemoving('');
    }
  }

  return (
    <div className="space-y-8">
      {/* ---------------- Identity ---------------- */}
      <form onSubmit={saveDetails} className="bb-card p-6 sm:p-8">
        <h2 className="bb-h3">Your account</h2>
        <p className="mt-2 text-xs text-bbInk/45">
          The name and email attached to the owner login.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="bb-label">Name</span>
            <input
              type="text"
              autoComplete="name"
              value={details.displayName}
              onChange={(event) => setDetails({ displayName: event.target.value })}
              required
              className="bb-input"
            />
          </label>

          <label className="block">
            <span className="bb-label">Sign-in email</span>
            <input type="email" value={admin.email} readOnly disabled className="bb-input opacity-60" />
            <span className="mt-2 block text-xs text-bbInk/40">
              This is the login and the first place reset links go.
            </span>
          </label>
        </div>

        {detailsState.errors.length > 0 && (
          <ul role="alert" className="mt-5 space-y-1 border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
            {detailsState.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        {detailsState.saved && (
          <p className="mt-5 border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            Name saved.
          </p>
        )}

        <button type="submit" disabled={detailsState.busy} className="bb-btn-solid mt-6 disabled:opacity-50">
          {detailsState.busy ? 'Saving…' : 'Save Name'}
        </button>
      </form>

      {/* ---------------- Password ---------------- */}
      <form onSubmit={savePassword} className="bb-card p-6 sm:p-8">
        <h2 className="bb-h3">Password</h2>
        <p className="mt-2 text-xs text-bbInk/45">
          Changing it signs out every other device using the old session.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="bb-label">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
              }
              required
              className="bb-input"
            />
          </label>

          <label className="block">
            <span className="bb-label">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={passwords.nextPassword}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, nextPassword: event.target.value }))
              }
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
              value={passwords.confirmPassword}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))
              }
              required
              className="bb-input"
            />
          </label>
        </div>

        {passwordState.errors.length > 0 && (
          <ul role="alert" className="mt-5 space-y-1 border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
            {passwordState.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        {passwordState.saved && (
          <p className="mt-5 border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
            Password changed. Other devices will need to sign in again.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={passwordState.busy} className="bb-btn-solid disabled:opacity-50">
            {passwordState.busy ? 'Saving…' : 'Change Password'}
          </button>
          <Link href="/admin/forgot" className="bb-btn-outline text-center">
            Forgot It Instead
          </Link>
        </div>
      </form>

      {/* ---------------- Recovery emails ---------------- */}
      <section className="bb-card p-6 sm:p-8">
        <h2 className="bb-h3">Recovery emails</h2>
        <p className="mt-2 text-xs leading-relaxed text-bbInk/45">
          Reset links go to the sign-in address and every <strong>verified</strong> address
          below. Up to 3.
        </p>

        {recoveryEmails.length === 0 ? (
          <p className="mt-6 text-sm text-bbInk/50">No recovery addresses yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {recoveryEmails.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 border border-bbLine p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm text-bbInk">{item.email}</p>
                  <p className={`mt-1 text-xs ${item.verified ? 'text-green-400' : 'text-bbGold/80'}`}>
                    {item.verified ? 'Verified — receives reset links' : 'Pending — open the confirmation email'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRecovery(item.id)}
                  disabled={removing === item.id}
                  className="bb-btn-outline text-xs disabled:opacity-50"
                >
                  {removing === item.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addRecovery} className="mt-6 space-y-3">
          <label className="block">
            <span className="bb-label">Add a recovery email</span>
            <input
              type="email"
              autoComplete="email"
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              required
              className="bb-input"
              placeholder="backup@example.com"
            />
          </label>

          {recoveryState.errors.length > 0 && (
            <ul role="alert" className="space-y-1 border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
              {recoveryState.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {recoveryState.message && (
            <p className="border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
              {recoveryState.message}
            </p>
          )}

          <button type="submit" disabled={recoveryState.busy} className="bb-btn-solid disabled:opacity-50">
            {recoveryState.busy ? 'Sending…' : 'Send Verification Email'}
          </button>
        </form>
      </section>
    </div>
  );
}
