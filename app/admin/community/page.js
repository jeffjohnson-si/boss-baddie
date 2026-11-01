import { redirect } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import AdminNav from '@/components/admin/AdminNav';
import { currentAdmin } from '@/lib/current-admin';
import { getCommunityStats } from '@/lib/community';
import { getCustomerTotals, readCustomersForAdmin } from '@/lib/customers';

export const metadata = {
  title: 'Community',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * ADMIN COMMUNITY — who is in the room, plus the way into it.
 *
 * MEMBERS ARE CUSTOMERS now: registering in the shop (with the texted code) is what
 * opens the community, so there is no separate member list to reconcile and no
 * approve/remove step. This page therefore shows the account list — the contact
 * details Patricia needs — and nothing else. Removing someone's access is not a
 * community action any more; it is an account decision, and there is no half-removed
 * state where a woman can shop but not read the room.
 *
 * Messages are not listed here. Patricia reads, replies to, pins and deletes them in
 * the room itself at /community/inside.
 */
export default async function AdminCommunityPage() {
  if (!(await currentAdmin())) {
    redirect('/admin/login');
  }

  const [customers, totals, roomStats] = await Promise.all([
    readCustomersForAdmin(),
    getCustomerTotals(),
    getCommunityStats(),
  ]);

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        <header className="flex flex-col gap-6 border-b border-bbLine pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo size="md" />
            <h1 className="bb-h2 mt-5">Community</h1>
            <p className="mt-2 text-sm text-bbInk/50">
              {totals.total} account{totals.total === 1 ? '' : 's'} · {totals.thisMonth} joined this
              month · {roomStats.messages} message{roomStats.messages === 1 ? '' : 's'} ·{' '}
              {roomStats.pinned} pinned
            </p>
          </div>

          <AdminNav current="/admin/community" />
        </header>

        {/* Her way into the room, ahead of everything else on this page. */}
        <Link
          href="/community/inside"
          className="bb-card mt-8 flex items-center justify-between gap-4 p-5 sm:p-6"
        >
          <span>
            <span className="block font-display text-lg text-bbInk">Open the chat</span>
            <span className="mt-1 block text-sm text-bbInk/50">
              Read The Baddies Corner, reply as the founder, pin or delete a message
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-bbRose">
            &rarr;
          </span>
        </Link>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-bbInk/50">
          Every account can read and post in the room — registering is the only requirement, so
          there is no approve or remove step. Email addresses and phone numbers are on this page and
          nowhere else; the other women only ever see each other&apos;s names.
        </p>

        <div className="mt-10">
          {customers.length === 0 ? (
            <p className="bb-prose">No accounts yet.</p>
          ) : (
            <ul className="divide-y divide-bbLine border-y border-bbLine">
              {customers.map((customer) => (
                <li
                  key={customer.id}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="font-display text-base text-bbInk">{customer.name}</p>
                    <p className="mt-1 text-xs text-bbInk/45">
                      {customer.phoneDisplay}
                      {customer.location ? ` · ${customer.location}` : ''}
                      {customer.email ? ` · ${customer.email}` : ''}
                    </p>
                  </div>

                  <p className="shrink-0 text-xs text-bbInk/40">
                    Joined {formatDate(customer.joinedAt)}
                    {customer.lastLoginAt ? ` · last in ${formatDate(customer.lastLoginAt)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date);
}
