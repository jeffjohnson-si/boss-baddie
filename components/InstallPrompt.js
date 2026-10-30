'use client';

import { useEffect, useState } from 'react';

/**
 * InstallPrompt — "put this shop on your home screen".
 *
 * Only offers what the browser actually supports:
 *   - Chrome / Edge / Android fire `beforeinstallprompt`, so there is a real button
 *     that opens the browser's own install dialog.
 *   - iOS Safari has no such event, so an iPhone gets the two-step instruction
 *     instead of a button that would do nothing.
 *   - Already installed (standalone display mode) or dismissed: nothing is shown.
 *
 * Deliberately not a floating banner. It sits on the account page, where someone
 * who has already signed in is the person most likely to want the app.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    function onBeforeInstall(event) {
      event.preventDefault();
      setDeferred(event);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    setInstalled(Boolean(standalone));
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  if (!deferred && !isIOS) return null;

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      const choice = await deferred.userChoice;
      if (choice?.outcome !== 'accepted') setDismissed(true);
    } catch {
      setDismissed(true);
    } finally {
      setDeferred(null);
    }
  }

  return (
    <div className="border border-bbRose/25 bg-bbRose/[0.06] p-5 sm:p-6">
      <p className="bb-label">The BOSS BADDIE app</p>
      <p className="mt-2 text-sm leading-relaxed text-bbInk/75">
        Add it to your home screen and it opens like an app — no browser bar, and your orders are
        one tap away.
      </p>

      {deferred ? (
        <button type="button" onClick={install} className="bb-btn-solid mt-4">
          Install App
        </button>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-bbInk/60">
          On iPhone: tap <strong className="text-bbInk">Share</strong>, then{' '}
          <strong className="text-bbInk">Add to Home Screen</strong>.
        </p>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-3 text-xs text-bbInk/40 underline-offset-4 hover:text-bbInk/70 hover:underline"
      >
        Not now
      </button>
    </div>
  );
}
