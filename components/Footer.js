import Link from 'next/link';

/**
 * Footer — a thin closing strip, per the reference.
 *
 * Socials on the left, phone number and the Solomon Islands label on the right,
 * then one quiet line for the quick links, the payment rule and the copyright.
 * "Can I pay by card?" is the question Patricia answers most often, so the
 * answer sits on every page.
 *
 * The phone number comes from NEXT_PUBLIC_WHATSAPP so it is changed in one
 * place, in the environment, and never edited in markup.
 */

const QUICK_LINKS = [
  { href: '/our-story', label: 'About Us' },
  { href: '/shop', label: 'Shop' },
  { href: '/shop/invoices', label: 'My Invoices' },
  { href: '/community', label: 'Community' },
  { href: '/contact', label: 'Contact' },
];

const SOCIALS = [
  {
    href: 'https://www.instagram.com/boss.baddieee',
    label: 'BOSS BADDIE on Instagram',
    name: 'Instagram',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    href: 'https://www.tiktok.com/@boss.baddieee',
    label: 'BOSS BADDIE on TikTok',
    name: 'TikTok',
    icon: (
      <>
        <path d="M14 4v9.2a3.2 3.2 0 1 1-3.2-3.2h.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 4c.4 2.4 2 3.9 4.4 4.1" strokeLinecap="round" />
      </>
    ),
  },
];

export default function Footer() {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP;

  return (
    <footer className="relative border-t border-bbLine bg-black">
      <div className="bb-container flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        {/* ---- Socials ---- */}
        <ul className="flex items-center gap-6">
          {SOCIALS.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex min-h-[44px] items-center gap-2.5 text-[13px] text-bbInk/60 transition-colors hover:text-bbRose"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  {s.icon}
                </svg>
                {s.name}
              </a>
            </li>
          ))}
        </ul>

        {/* ---- Phone + location ---- */}
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[13px] text-bbInk/60">
          {phone && (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, '')}`}
              className="flex min-h-[44px] items-center gap-2.5 transition-colors hover:text-bbRose"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 13l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 3 5.2A2 2 0 0 1 5 3Z" strokeLinejoin="round" />
              </svg>
              {phone}
            </a>
          )}

          <span className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            Solomon Islands
          </span>
        </div>
      </div>

      <div className="bb-container border-t border-bbLine/60 pb-6 pt-4">
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-1">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-xs text-bbInk/45 transition-colors hover:text-bbRose">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-3 flex flex-col gap-2 text-xs text-bbInk/35 sm:flex-row sm:items-center sm:justify-between">
          <p>
            No online card payment. Order, collect in person, and pay cash on the spot.{' '}
            <Link href="/contact" className="text-bbRose/80 underline-offset-4 hover:underline">
              How ordering works
            </Link>

          </p>
          <p>&copy; {new Date().getFullYear()} BOSS BADDIE · Founded by Patricia</p>
        </div>
      </div>
    </footer>
  );
}
