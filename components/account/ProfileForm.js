'use client';

import { useState } from 'react';

/**
 * ProfileForm — the details a customer can change: name and location.
 *
 * The EMAIL ADDRESS is shown but NOT editable: it is the login handle, so
 * changing it has to go through a fresh emailed code. The phone number is also
 * shown read-only — Patricia arranges collections on it, so she needs to know it
 * has not silently changed.
 *
 * The save is a PATCH to a route that takes the customer from the session cookie.
 * There is no id in the payload, so this form can only ever edit the person using
 * it. There is no password: sign-in is an emailed code.
 */
export default function ProfileForm({ customer }) {
  const [details, setDetails] = useState({
    name: customer.name,
    location: customer.location ?? '',
  });
  const [detailsState, setDetailsState] = useState({ errors: [], saved: false, busy: false });

  async function saveDetails(event) {
    event.preventDefault();
    setDetailsState({ errors: [], saved: false, busy: true });

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setDetailsState({ errors: data.errors ?? ['Could not save your details.'], saved: false, busy: false });
        return;
      }
      setDetailsState({ errors: [], saved: true, busy: false });
    } catch {
      setDetailsState({ errors: ['Could not reach the server.'], saved: false, busy: false });
    }
  }

  return (
    <div className="space-y-10">
      {/* ---------------- Details ---------------- */}
      <form onSubmit={saveDetails} noValidate className="bb-card p-6 sm:p-8">
        <h2 className="bb-h3">Your details</h2>
        <p className="mt-2 text-xs text-bbInk/45">
          These are prefilled into checkout, so you do not retype them every order.
        </p>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="bb-label">Name</span>
            <input
              type="text"
              autoComplete="name"
              value={details.name}
              onChange={(event) => setDetails((current) => ({ ...current, name: event.target.value }))}
              required
              className="bb-input"
            />
          </label>

          <label className="block">
            <span className="bb-label">Email address</span>
            <input type="email" value={customer.email ?? ''} readOnly disabled className="bb-input opacity-60" />
            <span className="mt-2 block text-xs text-bbInk/40">
              This is how you sign in. Message us if it needs changing.
            </span>
          </label>

          <label className="block">
            <span className="bb-label">Phone number</span>
            <input type="tel" value={customer.phoneDisplay} readOnly disabled className="bb-input opacity-60" />
            <span className="mt-2 block text-xs text-bbInk/40">
              Patricia uses this to reach you about collection.
            </span>
          </label>

          <label className="block">
            <span className="bb-label">Village, suburb or province</span>
            <input
              type="text"
              value={details.location}
              onChange={(event) => setDetails((current) => ({ ...current, location: event.target.value }))}
              className="bb-input"
              placeholder="e.g. Honiara — Ranadi, or Gizo"
            />
          </label>
        </div>

        <Feedback state={detailsState} okMessage="Saved." />

        <button type="submit" disabled={detailsState.busy} className="bb-btn-solid mt-5 w-full disabled:opacity-50 sm:w-auto">
          {detailsState.busy ? 'Saving…' : 'Save Details'}
        </button>
      </form>
    </div>
  );
}

function Feedback({ state, okMessage }) {
  if (state.errors?.length > 0) {
    return (
      <div role="alert" className="mt-5 border border-bbRose/50 bg-bbRose/[0.07] p-4">
        <ul className="list-inside list-disc space-y-1 text-sm text-bbInk/80">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (state.saved) {
    return (
      <p role="status" className="mt-5 text-sm text-bbBlush">
        {okMessage}
      </p>
    );
  }

  return null;
}
