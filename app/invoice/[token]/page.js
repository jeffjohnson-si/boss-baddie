import { notFound } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import OrderDocument from '@/components/OrderDocument';
import PrintButton from '@/components/PrintButton';
import { Sparkle } from '@/components/Decor';
import { formatPrice } from '@/lib/products';
import { isInvoiceReady, readOrderByInvoiceToken } from '@/lib/orders';

/**
 * THE CUSTOMER'S INVOICE  —  /invoice/<token>
 *
 * One customer's own invoice, opened from the private link she is given when she
 * orders and again in the message Patricia sends her. Printable, so she can keep a
 * copy or save it as a PDF.
 *
 * HOW IT IS PROTECTED: a shop customer has no account — she gives a name, a phone
 * number and often no email at all — so there is nothing to log into. The token in
 * the URL is the whole authorisation: 24 random bytes, generated per order, never
 * derived from the order number. Anyone holding the link sees that one order and
 * nothing else. The server has no route that lists orders and no way to reach one
 * by counting order numbers upwards; the only list that exists is the customer's
 * own, kept in her browser by lib/my-invoices.js out of tokens she was handed.
 *
 * WHY THE INVOICE IS NOT ALWAYS HERE: the order is a request until Patricia has
 * looked at it. Until she has arranged a collection place or time, this page says
 * so instead of showing an invoice — an invoice that cannot tell you where to go
 * and when is not worth printing. The moment she saves the collection details in
 * /admin, the same link starts showing the finished invoice.
 */

export const metadata = {
  title: 'Your invoice',
  // Never let a private link into a search index.
  robots: { index: false, follow: false },
};

// Reads a mutable store and must reflect what Patricia saved a second ago.
export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }) {
  const { token } = await params; // Next.js 15 requires awaiting params
  const order = await readOrderByInvoiceToken(token);

  // Unknown or mistyped token. Deliberately the same 404 as any other missing
  // page: a distinct "wrong token" message would confirm which links exist.
  if (!order) notFound();

  const pickupLocation = process.env.NEXT_PUBLIC_PICKUP_LOCATION || 'Honiara, Solomon Islands';
  // `ready` means issued or paid. A voided order is deliberately not ready: the
  // page explains that instead of billing for something that was cancelled.
  const ready = isInvoiceReady(order);
  const voided = order.invoiceStatus === 'void';

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        <header className="bb-no-print text-center">
          <Link href="/" className="inline-block">
            <BrandLogo size="md" className="mx-auto" />
          </Link>
          <p className="bb-eyebrow mt-6">{ready ? 'Your invoice' : 'Your order'}</p>
          <h1 className="bb-h2 mt-3">{order.orderNumber}</h1>
        </header>

        {ready ? (
          <div className="mx-auto mt-10 max-w-2xl">
            {/* The paper document itself. Same component as Patricia's order
                sheet, so the two can never disagree about what was ordered. */}
            <OrderDocument order={order} variant="invoice" pickupLocation={pickupLocation} />

            <div className="bb-no-print mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <PrintButton className="bb-btn-solid w-full sm:w-auto">Print Or Save Invoice</PrintButton>
              <Link href="/shop" className="bb-btn-outline w-full text-center sm:w-auto">
                Keep Shopping
              </Link>
            </div>

            <p className="bb-no-print mt-4 text-center text-xs leading-relaxed text-bbInk/45">
              Choose &ldquo;Save as PDF&rdquo; in the print window to keep it on your phone. This
              link stays open, so you can come back to it any time before you collect.
            </p>

            {/* Back to the browser-local list of everything she has been given.
                Quiet, because the invoice above is the thing she came for. */}
            <p className="bb-no-print mt-3 text-center">
              <Link href="/invoices" className="bb-link">
                All My Invoices
              </Link>
            </p>
          </div>
        ) : (
          /* ---- Waiting on Patricia ---- */
          <div className="mx-auto mt-10 max-w-xl text-center">
            <Sparkle size={24} className="mx-auto" />

            <h2 className="bb-h3 mt-6">
              {voided ? 'This order was cancelled.' : 'Your invoice is being prepared.'}
            </h2>

            <p className="bb-prose mt-4">
              {voided
                ? 'Nothing is owed on this order. If you think that is wrong, message us and Patricia will sort it out.'
                : 'Patricia is reviewing your order. Your invoice is issued from her dashboard, and it appears on this page the moment she does — with where and when to collect.'}
            </p>

            {/* Enough to reassure her that the right thing was received, without
                being the invoice itself. */}
            <dl className="mx-auto mt-8 max-w-sm space-y-2 border-y border-bbLine py-6 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-bbInk/50">Order</dt>
                <dd className="font-mono">{order.orderNumber}</dd>
              </div>
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex justify-between gap-4">
                  <dt className="text-bbInk/50">
                    {item.qty} &times; {item.title}
                  </dt>
                  <dd>{formatPrice(item.lineTotal)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-bbLine pt-3">
                <dt className="font-semibold">To pay on collection</dt>
                <dd className="font-semibold text-bbRose">{formatPrice(order.total)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-bbInk/50">Collect at</dt>
                <dd>{pickupLocation}</dd>
              </div>
            </dl>

            <p className="mt-6 text-xs leading-relaxed text-bbInk/45">
              Keep this link — it opens this page on any phone, wherever you ordered from. Cash on
              collection, always: we will never ask you for card or bank details.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/shop" className="bb-btn-solid w-full text-center sm:w-auto">
                Keep Shopping
              </Link>
              <Link href="/contact" className="bb-btn-outline w-full text-center sm:w-auto">
                Message Us
              </Link>
            </div>

            <p className="bb-no-print mt-4 text-center">
              <Link href="/invoices" className="bb-link">
                All My Invoices
              </Link>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
