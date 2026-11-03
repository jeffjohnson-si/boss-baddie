import { redirect } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import AdminNav from '@/components/admin/AdminNav';
import { currentAdmin } from '@/lib/current-admin';
import {
  getIncomeSummary,
  getMonthlyIncome,
  getOrderStats,
  getRecentPayments,
  isInvoiceReady,
  readOrders,
} from '@/lib/orders';
import { getProductStats } from '@/lib/product-store';
import { formatPrice } from '@/lib/products';

export const metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false }, // never let this into a search index
};

// Every number on this page is live, so it must never be cached or prerendered.
export const dynamic = 'force-dynamic';

/**
 * ADMIN DASHBOARD — where Patricia lands when she signs in.
 *
 * This page answers one question: what needs me today? So the top of it is not a
 * grid of every statistic, it is a short list of things that are actually waiting
 * on her — and the most important of those is women who have ordered and cannot
 * see their invoice yet, because that only appears once she has filled in the
 * collection details.
 *
 * Underneath, one card per section with its own counts, so she can see the state
 * of the shop without opening three pages.
 *
 * The authorisation check happens HERE, in a server component, before any data is
 * read. An unauthenticated request is redirected and never receives the numbers.
 */
export default async function AdminDashboardPage() {
  if (!(await currentAdmin())) {
    redirect('/admin/login');
  }

  // Awaited one at a time on purpose. Each of these lazily initialises a
  // file-backed store, and two readers racing on a cold start would both seed it
  // and both write it back.
  const orders = await readOrders();
  const orderStats = await getOrderStats();
  const productStats = await getProductStats();

  const [income, monthlyIncome, recentPayments] = await Promise.all([
    getIncomeSummary(),
    getMonthlyIncome(6),
    getRecentPayments(5),
  ]);

  // Orders with no collection details yet. Each one is a customer who has been
  // promised an invoice and cannot see it until Patricia acts.
  const waitingForInvoice = orders.filter((order) => !isInvoiceReady(order)).length;

  const jobs = [];
  if (orderStats.new > 0) {
    jobs.push({
      href: '/admin/orders',
      label: `${orderStats.new} new order${orderStats.new === 1 ? '' : 's'} to look at`,
    });
  }
  if (waitingForInvoice > 0) {
    jobs.push({
      href: '/admin/orders',
      label: `${waitingForInvoice} order${waitingForInvoice === 1 ? '' : 's'} still waiting on collection details — until you fill those in, ${waitingForInvoice === 1 ? 'she' : 'they'} cannot see the invoice`,
    });
  }
  if (productStats.live === 0) {
    jobs.push({ href: '/admin/products', label: 'The shop is empty — add your first product' });
  }

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        {/* ---- Header ---- */}
        <header className="flex flex-col gap-6 border-b border-bbLine pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo size="md" />
            <h1 className="bb-h2 mt-5">Dashboard</h1>
            <p className="mt-2 text-sm text-bbInk/50">
              Everything you run, in one place.
            </p>
          </div>

          <AdminNav current="/admin" />
        </header>

        {/* ---- What needs her ---- */}
        <section className="mt-10">
          <h2 className="bb-eyebrow">Needs you</h2>

          {jobs.length === 0 ? (
            <p className="bb-prose mt-4">Nothing is waiting on you. Everything is handled.</p>
          ) : (
            <ul className="mt-4 divide-y divide-bbLine border-y border-bbLine">
              {jobs.map((job) => (
                <li key={job.label}>
                  <Link
                    href={job.href}
                    className="flex min-h-[56px] items-center justify-between gap-4 py-4 text-sm text-bbInk/85 transition-colors hover:text-bbRose"
                  >
                    <span>{job.label}</span>
                    <span aria-hidden="true" className="shrink-0 text-bbRose">
                      &rarr;
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- Income ----
            Cash in hand, counted the moment an invoice is marked Paid. */}
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="bb-eyebrow">Income</h2>
            <p className="text-xs text-bbInk/35">Cash collected — invoices marked Paid</p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <IncomeCard label="This week" value={income.week} count={income.weekCount} />
            <IncomeCard label="This month" value={income.month} count={income.monthCount} accent />
            <IncomeCard label="This year" value={income.year} count={income.yearCount} />
            <IncomeCard label="All time" value={income.allTime} count={income.allTimeCount} />
          </dl>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="bb-card p-5">
              <p className="bb-label">Last six months</p>
              {monthlyIncome.length === 0 ? (
                <p className="mt-2 text-sm text-bbInk/45">No payments recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {monthlyIncome.map((month) => (
                    <li key={month.label} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-bbInk/60">{month.label}</span>
                      <span className="font-semibold text-bbInk">{formatPrice(month.total)}</span>
                      <span className="w-20 text-right text-xs text-bbInk/35">
                        {month.payments} payment{month.payments === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bb-card p-5">
              <p className="bb-label">Recent payments</p>
              {recentPayments.length === 0 ? (
                <p className="mt-2 text-sm text-bbInk/45">Nothing collected yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-bbLine">
                  {recentPayments.map((payment) => (
                    <li key={payment.orderNumber} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-bbInk/80">{payment.customerName}</span>
                        <span className="font-mono text-[11px] text-bbInk/35">{payment.orderNumber}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-bbInk">{formatPrice(payment.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs text-bbInk/35">
            A payment is counted the moment you mark an invoice Paid. Pending, issued and
            voided invoices are not income.
          </p>
        </section>

        {/* ---- One card per section ---- */}
        <div className="mt-12 grid gap-4 sm:gap-5 lg:grid-cols-2">
          <SectionCard
            href="/admin/orders"
            title="Orders"
            headline={orderStats.total}
            headlineLabel={`order${orderStats.total === 1 ? '' : 's'} all together`}
            lines={[
              `${orderStats.new} new`,
              `${orderStats.awaitingPayment} awaiting payment`,
              `${orderStats.completed} completed`,
              `${formatPrice(orderStats.revenue)} confirmed`,
            ]}
          />

          <SectionCard
            href="/admin/products"
            title="Products"
            headline={productStats.live}
            headlineLabel="in the shop"
            lines={[
              `${productStats.soldOut} sold out`,
              `${productStats.archived} hidden`,
            ]}
          />
        </div>

        <p className="mt-6 text-xs text-bbInk/35">
          Confirmed revenue counts only orders marked paid, ready or completed. Nothing on this site
          charges a card — every order is paid in cash when it is collected.
        </p>
      </div>
    </section>
  );
}

/**
 * One income figure: the amount and how many payments made it.
 * The count matters as much as the total — three small sales and one big one can
 * look identical in a sum, and only one of those is a healthy week.
 */
function IncomeCard({ label, value, count, accent = false }) {
  return (
    <div className="bb-card p-4 sm:p-5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bbInk/45">{label}</dt>
      <dd className={`mt-2 font-display text-2xl ${accent ? 'text-bbRose' : 'text-bbInk'}`}>
        {formatPrice(value)}
      </dd>
      <dd className="mt-1 text-xs text-bbInk/40">
        {count} payment{count === 1 ? '' : 's'}
      </dd>
    </div>
  );
}

/**
 * One section of the admin, as a card that is entirely a link.
 * The whole card is the tap target rather than a small "view" link in the corner —
 * she will be using this on a phone.
 */
function SectionCard({ href, title, headline, headlineLabel, lines }) {
  return (
    <Link href={href} className="bb-card group flex flex-col p-5 sm:p-6">
      <h2 className="bb-eyebrow text-bbInk/45 transition-colors group-hover:text-bbRose">{title}</h2>

      <p className="mt-4 font-display text-4xl text-bbInk">{headline}</p>
      <p className="mt-1 text-xs text-bbInk/40">{headlineLabel}</p>

      <ul className="mt-5 space-y-1 border-t border-bbLine pt-4 text-sm text-bbInk/60">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Link>
  );
}
