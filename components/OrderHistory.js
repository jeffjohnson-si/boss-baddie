import Link from 'next/link';
import { Sparkle } from '@/components/Decor';
import { isInvoiceReady } from '@/lib/orders';
import { INVOICE_LABELS, STATUS_LABELS } from '@/lib/order-constants';
import { formatPrice } from '@/lib/products';

/**
 * OrderHistory — one customer's orders with their invoices.
 *
 * Shared by the shop's My Invoices tab and the account page, so the two can never
 * describe the same order differently. A server component: it renders finished
 * HTML and ships no JavaScript.
 *
 * @param {{ orders: object[] }} props orders from readOrdersForCustomer()
 */

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}

/** Status chip: rose while something is expected of her, quiet once it is done. */
function StatusChip({ status }) {
  const quiet = status === 'completed' || status === 'cancelled';
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        quiet ? 'border-bbInk/20 text-bbInk/45' : 'border-bbRose/40 bg-bbRose/10 text-bbBlush'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function OrderHistory({ orders }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="bb-card mt-6 p-6 sm:p-8">
        <Sparkle size={20} />
        <h3 className="bb-h3 mt-5">No orders yet.</h3>
        <p className="bb-prose mt-3">
          When you send your first order it appears here, with its invoice and the collection details
          Patricia arranges.
        </p>
        <Link href="/shop" className="bb-btn-solid mt-7">
          Explore Shop
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {orders.map((order) => {
        const ready = isInvoiceReady(order);
        const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);

        return (
          <li key={order.id} className="bb-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-bbInk">{order.orderNumber}</p>
                <p className="mt-1 text-xs text-bbInk/45">
                  {formatDate(order.createdAt)} · {itemCount} item{itemCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <StatusChip status={order.status} />
                <p className="text-sm font-semibold text-bbRose">{formatPrice(order.total)}</p>
              </div>
            </div>

            <ul className="mt-4 space-y-1 border-t border-bbLine pt-4 text-sm text-bbInk/70">
              {order.items.map((item, index) => (
                <li key={`${item.productId}-${index}`} className="flex justify-between gap-4">
                  <span>
                    {item.qty} &times; {item.title}
                  </span>
                  <span className="text-bbInk/45">{formatPrice(item.lineTotal)}</span>
                </li>
              ))}
            </ul>

            {ready && order.pickup?.place && (
              <p className="mt-4 border-l-2 border-bbRose/50 pl-3 text-xs leading-relaxed text-bbInk/60">
                Collect at <strong className="text-bbInk">{order.pickup.place}</strong>
                {order.pickup.when ? `, ${order.pickup.when}` : ''}
                {order.pickup.note ? ` — ${order.pickup.note}` : ''}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={`/invoice/${order.invoiceToken}`}
                className="bb-btn-outline min-h-[44px] px-5 text-[11px]"
              >
                {ready ? 'View Invoice' : 'Your Invoice'}
              </Link>

              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-bbInk/40">
                Invoice: {INVOICE_LABELS[order.invoiceStatus] ?? 'Pending'}
              </span>

              {!ready && order.invoiceStatus !== 'void' && (
                <span className="text-xs text-bbInk/40">
                  Being prepared — Patricia issues it from her dashboard.
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
