import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { Sparkle } from '@/components/Decor';

/**
 * OFFLINE — /offline
 *
 * Shown by the service worker when a page cannot be reached and there is no cached
 * copy of it. Deliberately quiet and honest: the site cannot take an order without
 * a connection, so it says so rather than offering a form that would fail.
 *
 * Precached at service-worker install time; no data of her own is ever stored in it.
 */

export const metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <section className="flex min-h-[70vh] items-center py-16">
      <div className="bb-container">
        <div className="mx-auto max-w-xl text-center">
          <BrandLogo size="lg" className="mx-auto" />
          <Sparkle size={22} className="mx-auto mt-8" />

          <h1 className="bb-h2 mt-5">You are offline.</h1>

          <p className="bb-prose mt-4">
            This page needs a connection. Your orders and invoices are safe — they are on the
            server, not on this screen — so come back when the signal does.
          </p>

          {/* A full page load, not a client navigation: the point of this button is
              to re-run the network request the service worker just failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="bb-btn-solid mt-8">
            Try Again
          </a>

          <p className="mt-6 text-xs leading-relaxed text-bbInk/40">
            Ordering needs a connection. If it keeps dropping, message us on WhatsApp and we will
            take your order down by hand.
          </p>

          <p className="mt-6 text-xs">
            <Link href="/contact" className="text-bbRose underline-offset-4 hover:underline">
              Contact details
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
