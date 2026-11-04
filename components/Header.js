'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { useCart } from '@/components/CartProvider';

/**
 * Header — a slim editorial navigation bar.
 *
 *  Desktop: logo hard left, links centred, bag + a "Message Us" pill right.

 *           Hairline bottom border, no boxes around the links, so the hero
 *           underneath does the talking.
 *  Mobile:  logo left, bag + hamburger right, full-width slide-down panel. The
 *           panel ends with Patricia's admin login — deliberately last and quiet,
 *           since it is for one person and no customer needs an account.


 *
 * The "Our Story" page is labelled "About Us" in the navigation — the route
 * keeps its original path so existing links and bookmarks still resolve.
 */

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/our-story', label: 'About Us' },
  { href: '/shop', label: 'Shop' },
  { href: '/contact', label: 'Contact' },
];

export default function Header({ signedIn = false }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  // Close the panel whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  // Lock background scroll while the mobile panel is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b border-bbLine bg-black/90 backdrop-blur-md">
      {/* Bar height is tied to the logo height (46 / 60px) plus breathing room,
          so the mark reads clearly without the bar feeling cramped. */}
      <div className="bb-container flex h-[72px] items-center justify-between gap-6 lg:h-[92px]">
        {/* ---- Logo, hard left on every breakpoint ---- */}
        <Link href="/" aria-label="BOSS BADDIE home" className="flex shrink-0 items-center">
          <BrandLogo size="sm" priority className="lg:hidden" />
          <BrandLogo size="md" priority className="hidden lg:block" />
        </Link>

        {/* ---- Desktop nav, centred between the logo and the actions ---- */}
        <nav aria-label="Main navigation" className="hidden flex-1 items-center justify-center gap-9 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`relative py-1 text-[15px] transition-colors
                ${isActive(link.href) ? 'text-bbRose' : 'text-bbInk/85 hover:text-bbRose'}`}
            >
              {link.label}
              {isActive(link.href) && (
                <span aria-hidden="true" className="absolute -bottom-0.5 left-0 h-px w-full bg-bbRose" />
              )}
            </Link>
          ))}
        </nav>

        {/* ---- Right side ---- */}
        <div className="flex shrink-0 items-center gap-3 lg:gap-4">
          {/* Her account, beside the bag: both are "your things". The label is the
              honest one for what tapping it does — signed out there is no account
              page to show, so it says Sign In rather than pretending otherwise.
              Signed in it says Account and opens /account, the same destination as
              the Account tab in the mobile bar; invoices and profile both live
              under it. Kept out of NAV_LINKS so six destination links do not crowd
              the centred desktop row. */}
          <Link
            href={signedIn ? '/account' : '/account/login'}
            aria-current={pathname === '/account' ? 'page' : undefined}
            className="hidden min-h-[44px] items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-bbInk/70 transition-colors hover:text-bbRose sm:flex"
          >
            {signedIn ? 'Account' : 'Sign In'}
          </Link>

          <CartLink count={count} />

          {/* Message Us — the founder-led brand's primary invitation. Goes to the

              contact page, where the WhatsApp number and hours live. Worded as a
              message rather than a booking because there is no calendar behind
              it: promising to "book" something the site cannot do loses trust at
              the first tap. */}
          <Link href="/contact" className="bb-pill hidden lg:inline-flex">
            Message Us

            <svg width="11" height="7" viewBox="0 0 11 7" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M1 1l4.5 4.5L10 1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>


          {/* Hamburger — 44px square, comfortable thumb target */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="bb-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="-mr-2 flex h-11 w-11 flex-col items-center justify-center gap-[6px] lg:hidden"
          >
            <span className={`block h-px w-6 bg-bbInk transition-transform duration-200 ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
            <span className={`block h-px w-6 bg-bbInk transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block h-px w-6 bg-bbInk transition-transform duration-200 ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* ---- Mobile panel ---- */}
      <div id="bb-mobile-nav" hidden={!open} className="border-t border-bbLine bg-black lg:hidden">
        <nav aria-label="Mobile navigation" className="bb-container flex flex-col py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex min-h-[58px] items-center justify-between border-b border-bbLine text-sm font-semibold uppercase tracking-[0.2em]
                ${isActive(link.href) ? 'text-bbRose' : 'text-bbInk'}`}
            >
              {link.label}
              <span aria-hidden="true" className="text-bbRose">&rarr;</span>
            </Link>
          ))}

          {/* The same destination as the desktop link and the Account tab in the
              mobile bar, so all three agree. Grouped with the destinations rather
              than the calls to action: it is where she looks for her own orders. */}
          <Link
            href={signedIn ? '/account' : '/account/login'}
            className={`flex min-h-[58px] items-center justify-between border-b border-bbLine text-sm font-semibold uppercase tracking-[0.2em]
              ${pathname === '/account' ? 'text-bbRose' : 'text-bbInk'}`}
          >
            {signedIn ? 'Account' : 'Sign In'}
            <span aria-hidden="true" className="text-bbRose">&rarr;</span>
          </Link>

          <Link href="/shop" className="bb-btn-solid mt-6 w-full">
            Shop Essentials
          </Link>
          <Link href="/our-story" className="bb-btn-outline mt-3 w-full">
            Discover Our Story
          </Link>
          <Link href="/contact" className="bb-pill mb-4 mt-3 w-full justify-center">
            Message Us
          </Link>

          {/* Same link as the desktop bar, kept last and quiet: it is for one
              person, and it should not compete with anything a customer came for. */}
          <Link
            href="/admin"
            aria-label="Patricia's login"
            className="mb-4 flex min-h-[44px] items-center justify-center text-[10px] font-semibold uppercase tracking-[0.22em] text-bbInk/40"
          >
            Patricia&apos;s Login
          </Link>


        </nav>
      </div>
    </header>
  );
}

/** Cart link — plain text on desktop, icon-free to keep the bar slim. */
function CartLink({ count }) {
  return (
    <Link
      href="/checkout"
      aria-label={`Your bag, ${count} item${count === 1 ? '' : 's'}`}
      className="flex min-h-[44px] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-bbInk/70 transition-colors hover:text-bbRose"
    >
      Bag
      <span
        className={`inline-flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-bold
          ${count > 0 ? 'bg-bbRose text-black' : 'border border-bbLine text-bbInk/50'}`}
      >
        {count}
      </span>
    </Link>
  );
}
