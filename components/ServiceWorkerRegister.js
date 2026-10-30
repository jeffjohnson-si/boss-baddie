'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegister — installs public/sw.js, once, after the page has loaded.
 *
 * ONLY IN PRODUCTION. A service worker in `next dev` caches the dev server's own
 * output, and the usual result is an afternoon spent debugging a page the browser
 * is serving from a cache rather than from the code just edited.
 *
 * Failure is silent on purpose: an offline cache is a nicety, and a customer who
 * blocks service workers should still be able to order.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    function register() {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Blocked, unsupported, or served over plain http on a non-localhost host.
      });
    }

    // Wait for the page to be usable before spending bandwidth on the worker.
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
