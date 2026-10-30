/* ==========================================================================
   BOSS BADDIE — service worker
   ==========================================================================
   WHAT IT IS FOR: the app should open on a bad connection. It is not an offline
   shop — ordering needs the server, and pretending otherwise would be worse than
   the honest "you are offline" page.

   THE RULES, deliberately simple:

     navigations      network first, one cached copy per page, offline page on
                      failure. Never a stale page when the network answers.

     /_next/static/*  cache first. These filenames contain a content hash, so a
     icons, logo      cached copy can never be out of date.

     everything else  untouched. API calls, RSC payloads and POSTs go straight to
                      the network: caching an order response or someone's data
                      would be a bug, not an optimisation.

   PRIVATE PAGES ARE NEVER CACHED. /account, /checkout, /invoice, /invoices and
   /admin are per-person; a cached copy would be readable after sign-out on a
   shared phone. They get network-only treatment with the offline page as fallback.

   Bump VERSION to throw every cache away on the next visit.
   ========================================================================== */

const VERSION = 'bb-v3';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = '/offline';

/** Small, non-personal, worth having before the network answers. */
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/logo-mark.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/** Anything that must never be written to a cache. */
const PRIVATE_PATHS = [/^\/account/, /^\/checkout/, /^\/invoice/, /^\/invoices/, /^\/admin/];

function isPrivate(pathname) {
  return PRIVATE_PATHS.some((pattern) => pattern.test(pathname));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Individually, so one 500 (a cold database, say) cannot fail the whole
      // install and leave the site without a worker at all.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch {
            /* try again on the next visit */
          }
        }),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handlePage(request, url));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.png' ||
    url.pathname === '/logo-mark.png' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(handleAsset(request));
  }
});

async function handlePage(request, url) {
  // Private pages: the network or the offline page, never the cache.
  if (isPrivate(url.pathname)) {
    try {
      return await fetch(request);
    } catch {
      return offlinePage();
    }
  }

  const cache = await caches.open(PAGES_CACHE);

  try {
    const response = await fetch(request);
    // Only successful, same-origin HTML is worth keeping.
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: false });
    return cached ?? (await offlinePage());
  }
}

async function handleAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function offlinePage() {
  const cached = await caches.match(OFFLINE_URL);
  if (cached) return cached;

  return new Response(
    '<!doctype html><meta charset="utf-8"><title>Offline</title><body style="background:#000;color:#f8f8f8;font-family:Georgia,serif;display:grid;place-items:center;height:100vh;margin:0"><p>You are offline.</p></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
