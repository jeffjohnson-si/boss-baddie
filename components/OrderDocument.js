import { formatPrice } from '@/lib/products';

/**
 * OrderDocument — the paper trail for one order.
 *
 * Two documents, one layout, because they must never disagree about what was
 * ordered or what it costs:
 *
 *   variant="invoice"  the CUSTOMER's copy, rendered at /invoice/<token> — her own
 *                      private link. It only appears once Patricia has arranged the
 *                      collection; before that the page says the invoice is being
 *                      prepared and this component is not rendered at all. Headed
 *                      "Invoice", with "Amount due on collection", because nothing
 *                      has been charged: she pays cash when she collects.
 *   variant="sheet"    PATRICIA's copy, printed from /admin. The same lines plus
 *                      the customer's contact details and the collection details
 *                      she has arranged, so she can pick the order and hand it over
 *                      with the paperwork in her hand.
 *
 * WHY THIS IS HTML AND NOT A GENERATED PDF: a PDF library is a large dependency to
 * download and run for a document the browser can already print or save as a PDF
 * itself. On a slow island connection that is the whole difference. The print rules
 * in globals.css (`@media print`) hide the rest of the site so only this element
 * reaches the paper.
 *
 * There is deliberately NO TAX LINE and no registration number: the price shown is
 * the price paid. Add one only if Patricia registers for GST.
 *
 * Deliberately a server-safe presentational component — no state, no effects — so
 * either page can render it.
 *
 * NOTE ON `order`: this needs a FULL stored order — customer, items, pickup. The
 * JSON that POST /api/orders returns is deliberately much smaller (order number,
 * total, currency, invoice link) and would throw here. Read the order from the
 * store instead.
 *
 * @param {{
 *   order: object,                  a full stored order
 *   variant?: 'invoice'|'sheet',
 *   pickupLocation?: string,        the town, printed under the brand name
 * }} props
 */

export default function OrderDocument({ order, variant = 'invoice', pickupLocation = '' }) {
  const isSheet = variant === 'sheet';
  const pickup = order.pickup ?? { place: '', when: '', note: '' };
  const arranged = Boolean(pickup.place || pickup.when);

  return (
    <article className="bb-doc bg-white p-8 text-black sm:p-10">
      {/* ---- Head ---- */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-black/15 pb-6">
        <div>
          <p className="font-display text-xl tracking-[0.12em]">BOSS BADDIE</p>
          <p className="mt-1 text-xs text-black/55">
            Women-owned · Solomon Islands
            {pickupLocation ? ` · ${pickupLocation}` : ''}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/60">
            {isSheet ? 'Order Sheet' : 'Invoice'}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{order.orderNumber}</p>
          <p className="mt-0.5 text-xs text-black/55">{formatDocDate(order.createdAt)}</p>
        </div>
      </header>

      {/* ---- Who ---- */}
      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
            {isSheet ? 'Customer' : 'Billed to'}
          </p>
          <p className="mt-2 text-sm font-semibold">{order.customer.name}</p>
          {/* The customer's copy shows her own details back to her; the order sheet
              needs them so Patricia can make contact. Same fields either way. */}
          <p className="mt-0.5 text-sm text-black/70">{order.customer.phone}</p>
          {order.customer.email && <p className="text-sm text-black/70">{order.customer.email}</p>}
          <p className="text-sm text-black/70">{order.customer.location}</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">Payment</p>
          <p className="mt-2 text-sm text-black/70">
            Cash on collection. Nothing has been charged online.
          </p>
          {isSheet && order.status && (
            <p className="mt-2 text-sm">
              <span className="text-black/45">Status: </span>
              <span className="font-semibold">{order.status.replace(/_/g, ' ')}</span>
            </p>
          )}
        </div>
      </section>

      {/* ---- What ---- */}
      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black/15 text-left text-[10px] uppercase tracking-[0.16em] text-black/45">
            <th scope="col" className="py-2 pr-3 font-semibold">Item</th>
            <th scope="col" className="py-2 pr-3 text-center font-semibold">Qty</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">Unit</th>
            <th scope="col" className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={`${item.productId}-${index}`} className="border-b border-black/10">
              <td className="py-3 pr-3">
                {item.title}
                {item.model && <span className="text-black/50"> — {item.model}</span>}
              </td>
              <td className="py-3 pr-3 text-center">{item.qty}</td>
              <td className="py-3 pr-3 text-right">{formatPrice(item.unitPrice)}</td>
              <td className="py-3 text-right">{formatPrice(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {/* No delivery line and no tax line: there is nothing to add to the bag,
              so subtotal and total are always the same number. */}
          <tr>
            <td colSpan={3} className="pt-4 text-right text-black/55">Subtotal</td>
            <td className="pt-4 text-right">{formatPrice(order.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="pt-1 text-right text-black/55">Collection</td>
            <td className="pt-1 text-right text-black/55">In person · free</td>
          </tr>
          <tr className="border-t border-black">
            <td colSpan={3} className="pt-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em]">
              {isSheet ? 'To collect' : 'Amount due on collection'}
            </td>
            <td className="pt-3 text-right font-display text-lg">{formatPrice(order.total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ---- Collection ---- */}
      <section className="mt-8 border border-black/15 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">Collection</p>
        {arranged ? (
          <div className="mt-2 space-y-1 text-sm">
            {pickup.place && (
              <p>
                <span className="text-black/45">Where: </span>
                {pickup.place}
              </p>
            )}
            {pickup.when && (
              <p>
                <span className="text-black/45">When: </span>
                {pickup.when}
              </p>
            )}
            {pickup.note && <p className="text-black/70">{pickup.note}</p>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-black/70">
            {isSheet
              ? 'Not arranged yet — set a place and time on the order in /admin, then message the customer.'
              : `Collected in person${pickupLocation ? ` in ${pickupLocation}` : ''}. We will message you a place and a time.`}
          </p>
        )}
      </section>

      {order.customer.notes && (
        <section className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">
            {isSheet ? 'Customer note' : 'Your note'}
          </p>
          <p className="mt-2 text-sm text-black/70">{order.customer.notes}</p>
        </section>
      )}

      <footer className="mt-8 border-t border-black/15 pt-4 text-xs leading-relaxed text-black/50">
        {isSheet ? (
          <p>Keep this with the order until it is collected and paid for.</p>
        ) : (
          <p>
            Quote <span className="font-mono">{order.orderNumber}</span> when you collect. This is not
            a receipt — we will confirm your order before you come, and payment is made in cash at
            collection. Thank you for supporting a woman-owned Solomon Islands business.
          </p>
        )}
      </footer>
    </article>
  );
}

/**
 * Fixed en-GB formatting so the server and the browser cannot disagree and trip
 * React's hydration check. Falls back to an empty string on a missing date rather
 * than printing "Invalid Date" on a customer's invoice.
 */
function formatDocDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
