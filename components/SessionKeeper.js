'use client';

import { useEffect } from 'react';

/**
 * SessionKeeper — keeps a signed-in session from ageing out.
 *
 * A cookie has a fixed expiry date (400 days, the longest browsers allow), so
 * "signed in until I log out" needs the date moved forward now and then. Once a day,
 * on a signed-in page, this asks /api/account/session/refresh for a fresh cookie.
 *
 * Cheap by design: one request per browser per day, no UI, and a failure is silent —
 * an offline phone simply tries again tomorrow and stays signed in with the cookie
 * it already has.
 */

const STORAGE_KEY = 'bb_session_refresh_at';
const ONE_DAY = 24 * 60 * 60 * 1000;

export default function SessionKeeper() {
  useEffect(() => {
    let last = 0;
    try {
      last = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0) || 0;
    } catch {
      // Storage blocked: still try once per page load. It is one small request.
    }

    if (Date.now() - last < ONE_DAY) return;

    let cancelled = false;

    fetch('/api/account/session/refresh', { method: 'POST' })
      .then((response) => {
        if (!cancelled && response.ok) {
          try {
            window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
          } catch {
            // Nothing to do; next page load will try again.
          }
        }
      })
      .catch(() => {
        // Offline or blocked. The existing cookie is still good.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
