'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/community/Avatar';

/**
 * CommunitySetupForm — the one-off step before the chat.
 *
 * Name and a picture. The phone number is shown but not editable: it came from the
 * account, and the room displays it beside her name so the other women know who
 * they are talking to.
 */
export default function CommunitySetupForm({ defaultName, phoneDisplay, currentAvatar }) {
  const router = useRouter();

  const [name, setName] = useState(defaultName ?? '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(currentAvatar ?? null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  function pickPicture(event) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    setFile(chosen);
    try {
      setPreview(URL.createObjectURL(chosen));
    } catch {
      // Preview is a nicety; the upload still works without it.
    }
  }

  async function submit(event) {
    event.preventDefault();
    setErrors([]);
    setBusy(true);

    const data = new FormData();
    data.set('name', name);
    if (file) data.set('file', file);

    try {
      const response = await fetch('/api/community/profile', { method: 'POST', body: data });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        setErrors(payload.errors ?? ['Could not save your profile. Try again.']);
        return;
      }

      router.push('/community/inside');
      router.refresh();
    } catch {
      setErrors(['Could not reach the server. Check your connection and try again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bb-card mt-8 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Avatar name={name || 'You'} src={preview} size={72} tone="rose" />

        <div className="w-full">
          <label className="block">
            <span className="bb-label">Your picture (optional)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={pickPicture}
              className="block w-full text-xs text-bbInk/60 file:mr-3 file:border file:border-bbLine file:bg-transparent file:px-3 file:py-2 file:text-[11px] file:font-semibold file:uppercase file:tracking-[0.14em] file:text-bbInk/70 hover:file:border-bbRose/60"
            />
          </label>
          <p className="mt-2 text-[11px] text-bbInk/40">PNG, JPEG or WebP, up to 2 MB.</p>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="bb-label">The name the room sees</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={40}
          className="bb-input"
          placeholder="What should the other baddies call you?"
        />
      </label>

      <label className="mt-5 block">
        <span className="bb-label">Phone number</span>
        <input
          type="tel"
          value={phoneDisplay}
          readOnly
          disabled
          className="bb-input opacity-60"
        />
        <span className="mt-2 block text-[11px] leading-relaxed text-bbInk/40">
          This comes from your account, where you set it. It is not shown to the other members —
          message us if you need it changed.
        </span>
      </label>

      {errors.length > 0 && (
        <div role="alert" className="mt-5 border border-bbRose/50 bg-bbRose/[0.07] p-4">
          <ul className="list-inside list-disc space-y-1 text-sm text-bbInk/80">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" disabled={busy} className="bb-btn-solid mt-7 w-full disabled:opacity-50">
        {busy ? 'Taking you in…' : 'Enter The Baddies Corner'}
      </button>
    </form>
  );
}
