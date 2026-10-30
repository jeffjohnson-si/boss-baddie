'use client';

import { useEffect, useState } from 'react';

/**
 * InstallBanner — the first-visit invitation to put the shop on a home screen.
 *
 * Appears on any page, a few seconds after the page is usable, once. Dismissing it
 * writes a local flag and it never comes back on that device.
 *
 * It only offers what the browser can do:
 *   - Chrome / Edge / Android: a real button, using `beforeinstallprompt`.
 *   - iOS Safari: the two-step Share instruction, because there is no event.
 *   - Anything else, or when already installed (standalone): nothing at all.
 */
const DISMISS_KEY = 'bb_install_dismissed_v1';

export default function InstallBanner() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let standalone = false;
    let dismissed = false;

    try {
      standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Storage blocked: fall through and decide from the browser alone.
    }

    if (standalone || dismissed) return undefined;

    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    function onPrompt(event) {
      event.preventDefault();
      setDeferred(event);
    }
    function onInstalled() {
      setVisible(false);
    }

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Not instantly: let her see the page first, then offer the app.
    const timer = setTimeout(() => setVisible(true), 3500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible) return null;
  if (!deferred && !isIOS) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Nothing stored; it may reappear next visit. Acceptable.
    }
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      const choice = await deferred.userChoice;
      if (choice?.outcome !== 'accepted') dismiss();
    } catch {
      dismiss();
    } finally {
      setDeferred(null);
    }
  }

  return (
    <div className="bb-no-print fixed inset-x-3 bottom-[76px] z-40 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-80">
      <div className="border border-bbRose/30 bg-black/95 p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-bbInk">Install BOSS BADDIE</p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center text-lg leading-none text-bbInk/40 hover:text-bbInk"
          >
            &times;
          </button>
        </div>

        <p className="mt-1 text-xs leading-relaxed text-bbInk/55">
          {deferred
            ? 'Add it to your home screen and it opens like an app — your orders are one tap away.'
            : 'On iPhone: tap Share, then Add to Home Screen.'}
        </p>

        {deferred && (
          <button type="button" onClick={install} className="bb-btn-solid mt-3 w-full text-[11px]">
            Install App
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-2 w-full text-[11px] text-bbInk/40 underline-offset-4 hover:text-bbInk/70 hover:underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
