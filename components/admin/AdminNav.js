import Link from 'next/link';
import LogoutButton from '@/components/admin/LogoutButton';

/**
 * ADMIN NAV — the one row of links across the top of Patricia's pages.
 *
 * Defined once here rather than copied into each page, because four hand-written
 * copies is how a section ends up missing from one page and mislabelled on another.
 *
 * @param {{ current?: string, viewHref?: string, viewLabel?: string }} props
 *   current   the href of the page being viewed, so it can mark itself
 *   viewHref  where "view the live site" goes — the shop page sends her to /shop
 */

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/account', label: 'Account' },
];

export default function AdminNav({ current = '', viewHref = '/', viewLabel = 'View site' }) {
  return (
    // Wraps on a narrow screen instead of overflowing: she will open this on a phone.
    <nav aria-label="Admin sections" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {LINKS.map((link) => {
        const active = link.href === current;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            // The page she is on is rose and not underlined on hover — a link to
            // where you already are should not look like somewhere to go.
            className={active ? 'text-sm text-bbRose' : 'bb-link'}
          >
            {link.label}
          </Link>
        );
      })}

      <Link href={viewHref} className="bb-link">
        {viewLabel}
      </Link>

      <LogoutButton />
    </nav>
  );
}
