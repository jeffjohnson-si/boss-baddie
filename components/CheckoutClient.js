'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProductArt from '@/components/ProductArt';
import PaymentNote from '@/components/PaymentNote';
import { Sparkle } from '@/components/Decor';

import { useCart } from '@/components/CartProvider';
import { formatPrice } from '@/lib/products';
import { rememberInvoice } from '@/lib/my-invoices';

/**
 * CheckoutClient — the manual order form.
 *
 * THERE IS NO PAYMENT STEP HERE. That is the whole point: no card fields, no
 * gateway, no redirect to a processor, and no bank details to transfer to. The
 * customer sends her details and her bag, and pays cash when she collects.
 *
 * THERE IS NO DELIVERY EITHER. Nothing in the Solomon Islands will carry a parcel
 * to a customer's door, so every order is collected in person. That is why this
 * form has no delivery option, no address field and no fee: the total is the sum
 * of the bag, and she pays it in cash when she collects.
 *
 * The totals shown here are a preview for the customer. The server recalculates
 * every price again in lib/orders.js, and the server's numbers are the ones that
 * count.
 */

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  location: '',
  // Both are recorded on the order so the stored data says what happened, not
  // asked for: pickup is the only way to receive an order and cash on collection
  // is the only way to pay for one.
  fulfilment: 'pickup',
  paymentMethod: 'cash_on_pickup',
  notes: '',
};

/**
 * The form starts from her account, which is the point of having one: on a phone
 * in Honiara, retyping a name, number and village for every order is the sort of
 * friction that loses the order entirely.
 *
 * Also used after a successful order to reset the form WITHOUT wiping her details.
 */
function initialForm(customer) {
  return {
    ...EMPTY_FORM,
    name: customer?.name ?? '',
    phone: customer?.phoneDisplay ?? '',
    email: customer?.email ?? '',
    location: customer?.location ?? '',
  };
}

export default function CheckoutClient({ customer }) {
  const { items, subtotal, count, hydrated, setQty, removeItem, clearCart } = useCart();

  const [form, setForm] = useState(() => initialForm(customer));
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  /** @type {[null|{orderNumber:string,total:number,currency:string,invoiceUrl:string}, Function]} */
  const [confirmed, setConfirmed] = useState(null);
  const [copied, setCopied] = useState(false);


  // Public information, printed on the page — safe in a NEXT_PUBLIC_ var.
  const pickup = process.env.NEXT_PUBLIC_PICKUP_LOCATION || 'Honiara, Solomon Islands';

  // Nothing is added on top of the bag, so the total IS the subtotal.
  const total = subtotal;


  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          // Only identity and quantity are sent. Prices are looked up server-side.
          items: items.map((i) => ({ productId: i.productId, qty: i.qty, model: i.model })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Something went wrong. Please try again.']);
        return;
      }

      setConfirmed(data.order);

      // Her invoice, recorded on this device (/invoices) before the bag is
      // cleared — the item count is only known until then. This cannot fail the
      // order: the server has already stored it, and the helper swallows a
      // blocked or full localStorage. Her link is still printed on screen below.
      rememberInvoice({
        token: data.order.invoiceUrl,
        orderNumber: data.order.orderNumber,
        total: data.order.total,
        currency: data.order.currency,
        itemCount: count,
        placedAt: new Date().toISOString(),
      });

      clearCart();
      setForm(initialForm(customer));
    } catch {
      // Offline or the request timed out — very possible on an island connection.
      setErrors([
        'We could not reach the server. Check your connection and try again, or message us on WhatsApp.',
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Confirmation ---------------- */
  if (confirmed) {
    // Absolute, so it is useful when she copies it into a message to herself.
    const invoiceLink =
      typeof window === 'undefined'
        ? confirmed.invoiceUrl
        : `${window.location.origin}${confirmed.invoiceUrl}`;

    async function copyInvoiceLink() {
      try {
        await navigator.clipboard.writeText(invoiceLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard blocked (older browser, or plain http) — the link is printed
        // on screen right above the button, so she can still select it by hand.
        setCopied(false);
      }
    }

    return (

      <div className="mx-auto max-w-2xl text-center">
        <Sparkle size={26} className="mx-auto" />

        <h2 className="bb-h2 mt-6">Order received.</h2>

        <p className="bb-prose mt-4">
          Your reference is{' '}
          <strong className="font-semibold text-bbRose">{confirmed.orderNumber}</strong>. Nothing has
          been charged. Patricia will message you to confirm your total and tell you where and when
          to collect it.
        </p>

        <dl className="mx-auto mt-8 max-w-sm space-y-2 border-y border-bbLine py-6 text-sm">
          <div className="flex justify-between">
            <dt className="text-bbInk/50">Order</dt>
            <dd className="font-mono">{confirmed.orderNumber}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bbInk/50">Amount due</dt>
            <dd className="font-semibold text-bbRose">
              {confirmed.currency} ${confirmed.total}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bbInk/50">Payment</dt>
            <dd>Cash when you collect</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bbInk/50">Collect at</dt>
            <dd>{pickup}</dd>
          </div>
        </dl>

        <p className="mt-6 text-xs leading-relaxed text-bbInk/45">
          Keep your order reference — quote it when you come to collect.
        </p>

        {/* ---- Her invoice link ----
            No invoice on this screen, on purpose: until Patricia has confirmed the
            order and worked out a collection place and time, an invoice cannot tell
            the customer where to go, so there is nothing worth printing yet. The
            link below is her own private way back to it — it shows a "being
            prepared" note now and the finished invoice the moment Patricia saves
            the collection details. The token in it is unguessable, so it reaches
            her order and nobody else's. */}
        <div className="mt-10 border border-bbRose/25 bg-bbRose/[0.06] p-5 text-left">
          <p className="bb-label">Your invoice</p>
          <p className="mt-2 text-sm leading-relaxed text-bbInk/75">
            Patricia will confirm your order and arrange your collection, then your invoice appears
            here:
          </p>

          <p className="mt-3 break-all font-mono text-xs text-bbInk/60">{invoiceLink}</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link href={confirmed.invoiceUrl} className="bb-btn-solid w-full text-center sm:w-auto">
              Open My Invoice
            </Link>
            <button type="button" onClick={copyInvoiceLink} className="bb-btn-outline w-full sm:w-auto">
              {copied ? 'Link Copied' : 'Copy Link'}
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-bbInk/45">
            Save this link — bookmark it, or copy it into a message to yourself. It opens your
            invoice on any phone, and Patricia will send it again when she messages you.
          </p>

          {/* The same link is kept on this device AND, now, on her account. Said
              here so she knows where to look from a different phone. */}
          <p className="mt-3 text-xs leading-relaxed text-bbInk/45">
            It is already in{' '}
            <Link href="/account" className="text-bbRose underline-offset-4 hover:underline">
              your account
            </Link>
            , so you can open it from any phone you sign in on. The copy above is still worth keeping.
          </p>
        </div>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/shop/invoices" className="bb-btn-solid w-full sm:w-auto">
            View My Invoices
          </Link>
          <Link href="/shop" className="bb-btn-outline w-full sm:w-auto">
            Keep Shopping
          </Link>
        </div>
      </div>
    );
  }


  /* ---------------- Loading the stored bag ---------------- */
  // Until localStorage has been read, showing "your bag is empty" would be a lie.
  if (!hydrated) {
    return <p className="bb-prose">Loading your bag…</p>;
  }

  /* ---------------- Empty bag ---------------- */
  if (count === 0) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h2 className="bb-h3">Your bag is empty.</h2>
        <p className="bb-prose mt-3">Pick something out and it will show up here.</p>
        <Link href="/shop" className="bb-btn-solid mt-8">
          Explore Shop
        </Link>
      </div>
    );
  }

  /* ---------------- Bag + order form ---------------- */
  return (
    <>
      {/* Who she is ordering as. Accounts prefill the form below, but a customer
          ordering for a friend may still change the name and number, so this is
          context rather than a locked field. */}
      {customer && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-bbLine px-4 py-3">
          <p className="text-xs text-bbInk/55">
            Ordering as <span className="font-semibold text-bbInk">{customer.name}</span>
            {' · '}
            {customer.phoneDisplay}
          </p>
          <Link
            href="/account/profile"
            className="text-xs text-bbRose underline-offset-4 hover:underline"
          >
            Change details
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
      {/* ================= LEFT: your details ================= */}
      <div>
        <h2 className="bb-h3">Your details</h2>
        <p className="mt-2 text-xs text-bbInk/45">
          We only ask for what we need to reach you and arrange your collection.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="bb-label">Full name *</span>
            <input {...field('name')} type="text" required autoComplete="name" className="bb-input" placeholder="Your name" />
          </label>

          <label>
            <span className="bb-label">Phone *</span>
            <input
              {...field('phone')}
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              className="bb-input"
              placeholder="+677 …"
            />
          </label>

          <label>
            <span className="bb-label">Email (optional)</span>
            <input {...field('email')} type="email" autoComplete="email" className="bb-input" placeholder="you@example.com" />
          </label>

          <label className="sm:col-span-2">
            <span className="bb-label">Village, suburb or province *</span>
            <input
              {...field('location')}
              type="text"
              required
              className="bb-input"
              placeholder="e.g. Honiara — Ranadi, or Gizo"
            />
          </label>
        </div>

        {/* ---- Collection and payment ----
            A statement, not a choice: there is nothing to pick between on either
            count. Shown as its own panel so a first-time customer knows before she
            sends the form that she collects it herself and pays cash on the spot. */}
        <div className="mt-10 border border-bbRose/25 bg-bbRose/[0.06] p-5">
          <p className="bb-label">Collection and payment</p>
          <p className="mt-2 text-sm leading-relaxed text-bbInk/75">
            Orders are collected in person at <strong className="text-bbInk">{pickup}</strong>. There
            is no courier or postal delivery, so nothing is added to your total — we message you a
            time that works, and you <strong className="text-bbInk">pay cash when you collect</strong>.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-bbInk/45">
            No card payment, no bank transfer, nothing to send in advance. We will never ask you for
            card or bank details.
          </p>
        </div>

        <label className="mt-8 block">
          <span className="bb-label">Anything we should know? (optional)</span>
          <textarea
            {...field('notes')}
            rows={4}
            maxLength={1000}
            className="bb-input resize-y"
            placeholder="Exact phone model, custom name spelling, preferred pickup day…"
          />
        </label>

        {/* ---- Validation errors ---- */}
        {errors.length > 0 && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-8 border border-bbRose/50 bg-bbRose/[0.07] p-5"
          >
            <p className="text-sm font-semibold text-bbBlush">Please check the following:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-bbInk/80">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="submit" disabled={submitting} className="bb-btn-solid mt-9 w-full disabled:opacity-50">
          {submitting ? 'Sending…' : 'Send My Order'}
        </button>

        <p className="mt-3 text-center text-xs text-bbInk/40">
          Sending this does not charge you anything.
        </p>
      </div>

      {/* ================= RIGHT: bag summary ================= */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <h2 className="bb-h3">Your bag</h2>

        <ul className="mt-6 divide-y divide-bbLine border-y border-bbLine">
          {items.map((item, index) => (
            <li key={`${item.productId}-${item.model}`} className="flex gap-4 py-4">
              <div className="h-20 w-16 shrink-0 overflow-hidden border border-bbLine">
                <ProductArt product={item.product} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm text-bbInk">{item.title}</p>
                {item.model && <p className="mt-0.5 truncate text-xs text-bbInk/45">{item.model}</p>}

                <div className="mt-2 flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Quantity for {item.title}</span>
                    <input
                      type="number"
                      min="1"
                      max="25"
                      value={item.qty}
                      onChange={(e) => setQty(index, Number(e.target.value))}
                      className="w-16 border border-bbLine bg-black/60 px-2 py-1 text-sm text-bbInk"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-xs text-bbInk/45 underline-offset-4 hover:text-bbRose hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <p className="shrink-0 text-sm text-bbInk">{formatPrice(item.lineTotal)}</p>
            </li>
          ))}
        </ul>

        {/* ---- Totals ----
            No delivery row: there is nothing between the bag and the total. */}
        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-bbInk/50">Subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-bbInk/50">Collection</dt>
            <dd>In person · free</dd>
          </div>
          <div className="flex justify-between border-t border-bbLine pt-3 text-base">
            <dt className="font-semibold">Total due</dt>
            <dd className="font-semibold text-bbRose">{formatPrice(total)}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-bbInk/40">
          We confirm this total with you before any money moves.
        </p>

        <div className="mt-8">
          <PaymentNote />
        </div>
      </aside>
      </form>
    </>
  );
}

