'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * BottomNav — the app-style tab bar, phones only.
 *
 * This is the single biggest "feels like an app" cue, and it costs three links: the
 * things a customer actually does here are browse, shop and manage her account.
 * Her invoices live inside the shop (/shop/invoices) as a tab, not as a fifth
 * destination, so this bar stays about places rather than documents. The desktop
 * site keeps the editorial top nav; below `lg` the tabs are the navigation.
 *
 * Hidden from print (the invoice and order sheet must stay paper-only) and padded
 * for the home-indicator area on an installed iOS PWA.
 */

const TABS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: '/shop',
    label: 'Shop',
    icon: (
      <>
        <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
        <path d="M9.5 8V6.5a2.5 2.5 0 0 1 5 0V8" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" />
      </>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href) {
    if (href === '/') return pathname === '/';
    // /account must not light up while she is on /account/profile.
    if (href === '/account') return pathname === '/account';
    // Everything under /shop counts as the Shop tab, invoices included — there is
    // no separate Invoices destination in this bar.
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      aria-label="Main navigation"
      className="bb-no-print fixed inset-x-0 bottom-0 z-50 border-t border-bbLine bg-black/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = isActive(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                  active ? 'text-bbRose' : 'text-bbInk/50 hover:text-bbInk/80'
                }`}
              >
                <svg
                  width="21"
                  height="21"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 1.9 : 1.5}
                  aria-hidden="true"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
