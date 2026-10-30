import Link from 'next/link';

/**
 * ShopTabs — "Shop" and "My Invoices" inside the same shop area.
 *
 * The invoices already exist at /invoice/<token>; this is the list of them, and it
 * belongs here rather than on a separate account page because that is where a
 * customer goes looking for what she bought.
 *
 * Server component, `current` passed by each page, so no client JavaScript is
 * needed to know which tab is active.
 */

const TABS = [
  { id: 'shop', href: '/shop', label: 'Shop' },
  { id: 'invoices', href: '/shop/invoices', label: 'My Invoices' },
];

export default function ShopTabs({ current }) {
  return (
    <nav aria-label="Shop sections" className="border-b border-bbLine">
      <div className="bb-container flex gap-1">
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`relative px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                active ? 'text-bbRose' : 'text-bbInk/55 hover:text-bbInk'
              }`}
            >
              {tab.label}
              {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-px bg-bbRose" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
