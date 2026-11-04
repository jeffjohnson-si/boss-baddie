import { redirect } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import AdminNav from '@/components/admin/AdminNav';
import OrdersTable from '@/components/admin/OrdersTable';
import { currentAdmin } from '@/lib/current-admin';
import { getOrderStats, readOrders } from '@/lib/orders';
import { formatPrice } from '@/lib/products';

export const metadata = {
  title: 'Orders',
  robots: { index: false, follow: false }, // never let this into a search index
};

// Orders change constantly, so this page must never be cached or prerendered.
export const dynamic = 'force-dynamic';

/**
 * ADMIN ORDERS — every order that has come in.
 *
 * The authorisation check happens HERE, in a server component, before any order
 * data is read. An unauthenticated request is redirected and never receives the
 * customer data at all — hiding the UI in the browser would not be security.
 *
 * This used to live at /admin. It moved so that /admin can be a dashboard: orders
 * are one part of running the shop, not the whole of it.
 */
export default async function AdminOrdersPage() {
  if (!(await currentAdmin())) {
    redirect('/admin/login');
  }

  // Two independent reads, so they go out together rather than back to back.
  const [orders, stats] = await Promise.all([readOrders(), getOrderStats()]);

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        {/* ---- Header ---- */}
        <header className="flex flex-col gap-6 border-b border-bbLine pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo size="md" />
            <h1 className="bb-h2 mt-5">Orders</h1>
            <p className="mt-2 text-sm text-bbInk/50">
              Every order that has come in. Nothing here has been charged automatically.
            </p>
          </div>

          <AdminNav current="/admin/orders" />
        </header>

        {/* ---- Stat cards ---- */}
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatCard label="Total orders" value={stats.total} />
          <StatCard label="New" value={stats.new} accent />
          <StatCard label="Awaiting payment" value={stats.awaitingPayment} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Confirmed revenue" value={formatPrice(stats.revenue)} wide />
        </dl>

        <p className="mt-3 text-xs text-bbInk/35">
          Revenue counts only orders marked paid, ready or completed.
        </p>

        {/* ---- Order list ---- */}
        <div className="mt-12">
          <OrdersTable orders={orders} />
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, accent = false, wide = false }) {
  return (
    <div className={`bb-card p-4 sm:p-5 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bbInk/45">{label}</dt>
      <dd className={`mt-2 font-display text-2xl ${accent ? 'text-bbRose' : 'text-bbInk'}`}>{value}</dd>
    </div>
  );
}
