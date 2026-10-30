'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * ADMIN BAR — the thin strip that tells Patricia she is still signed in.
 *
 * Without it, tapping "View site" dropped her onto the storefront with no sign she
 * was still the founder and no way back except typing the URL. Now the bar follows
 * her around the public site, so browsing it is something she does FROM the admin
 * rather than a one-way exit.
 *
 * It is a client component only so it can read the current path and get out of the
 * way on /admin pages, which already have their own navigation. Whether she is
 * signed in is decided on the SERVER (the root layout verifies the session cookie
 * and passes `active`), because a browser is not allowed to decide that.
 *
 * @param {{ active: boolean }} props active is true only for a valid admin session
 */
export default function AdminBar({ active }) {
  const pathname = usePathname();

  if (!active) return null;
  // The admin pages have AdminNav; a second bar above it would be noise.
  if (pathname.startsWith('/admin')) return null;

  return (
    // Sits above the sticky header in the document so it never covers content.
    // Gold rather than rose: rose is the brand's colour for customers, and this
    // strip is not part of the storefront.
    <div className="border-b border-bbGold/30 bg-bbGold/[0.08] print:hidden">
      <div className="bb-container flex min-h-[40px] flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bbGold">
          Signed in as Patricia
          <span className="ml-2 font-normal normal-case tracking-normal text-bbInk/45">
            You are looking at the live site
          </span>
        </p>

        <nav aria-label="Admin shortcuts" className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bbGold underline-offset-4 hover:underline"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/orders"
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bbInk/50 underline-offset-4 hover:text-bbGold hover:underline"
          >
            Orders
          </Link>
          <Link
            href="/admin/products"
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bbInk/50 underline-offset-4 hover:text-bbGold hover:underline"
          >
            Products
          </Link>
        </nav>
      </div>
    </div>
  );
}
