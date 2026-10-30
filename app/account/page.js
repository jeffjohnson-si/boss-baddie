import { redirect } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import SignOutButton from '@/components/account/SignOutButton';
import InstallPrompt from '@/components/InstallPrompt';
import OrderHistory from '@/components/OrderHistory';
import { currentCustomer } from '@/lib/current-customer';
import { getCustomerStats } from '@/lib/customers';
import { readOrdersForCustomer } from '@/lib/orders';
import { formatPrice } from '@/lib/products';

/**
 * YOUR ACCOUNT — /account
 *
 * The settings-and-summary screen. The full order history lives inside the shop at
 * /shop/invoices, which is where a customer looks for it; this page shows the last
 * three orders so there is still something to see at a glance.
 *
 * Signed out? Straight to the sign-in page, with `next` pointing back here.
 */

export const metadata = {
  title: 'Your Account',
  description: 'Your BOSS BADDIE account, orders and collection details.',
  robots: { index: false, follow: false },
};

function firstName(name) {
  return String(name ?? '').trim().split(/\s+/)[0] || 'there';
}

export default async function AccountPage() {
  const customer = await currentCustomer();
  if (!customer) redirect('/account/login?next=/account');

  const [orders, stats] = await Promise.all([
    readOrdersForCustomer(customer.id),
    getCustomerStats(customer.id),
  ]);

  const pickupLocation = process.env.NEXT_PUBLIC_PICKUP_LOCATION || 'Honiara, Solomon Islands';

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        {/* ---- Who is signed in ---- */}
        <header className="flex flex-col gap-6 border-b border-bbLine pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo size="md" />
            <p className="bb-eyebrow mt-6">Your Account</p>
            <h1 className="bb-h2 mt-3">Hi, {firstName(customer.name)}.</h1>
            <p className="mt-2 text-sm text-bbInk/50">
              {customer.phoneDisplay}
              {customer.location ? ` · ${customer.location}` : ''}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/account/profile" className="bb-btn-outline w-full text-center sm:w-auto">
              Profile &amp; Settings
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* ---- What it adds up to ---- */}
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Orders" value={stats.orders} />
          <StatCard label="To pay on collection" value={formatPrice(stats.due)} accent />
          <StatCard label="Paid so far" value={formatPrice(stats.spent)} />
          <StatCard label="Open orders" value={stats.open} />
        </dl>

        <p className="mt-3 text-xs text-bbInk/35">
          Money is settled in cash when you collect at {pickupLocation}. Nothing is charged online.
        </p>

        {/* ---- Recent orders ---- */}
        <div className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="bb-h3">Your orders</h2>
            <Link
              href="/shop/invoices"
              className="text-xs text-bbInk/45 underline-offset-4 hover:text-bbRose hover:underline"
            >
              All invoices
            </Link>
          </div>

          <OrderHistory orders={orders.slice(0, 3)} />

          {orders.length > 3 && (
            <p className="mt-6 text-center">
              <Link href="/shop/invoices" className="bb-link">
                See all {orders.length} invoices
              </Link>
            </p>
          )}
        </div>

        <div className="mt-12">
          <InstallPrompt />
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, accent = false }) {
  return (
    <div className="bb-card p-4 sm:p-5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bbInk/45">{label}</dt>
      <dd className={`mt-2 font-display text-2xl ${accent ? 'text-bbRose' : 'text-bbInk'}`}>{value}</dd>
    </div>
  );
}
