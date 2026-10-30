import { Sparkle } from '@/components/Decor';

/**
 * PaymentNote — the Solomon Islands payment rule, stated plainly.
 *
 * BUSINESS RULE: one way to pay — cash, in person, when the order is collected.
 * There is no online card gateway anywhere in this project, and no bank transfer
 * either: a customer submits an order form, Patricia messages her a place and a
 * time, and the money changes hands as the order does. Nothing is charged
 * automatically and no bank details are published on the site.
 *
 * This component is the single place that wording lives, so the checkout page,
 * the shop sidebar and any future page can never drift apart on the detail.
 *
 * The pickup town and WhatsApp number come from NEXT_PUBLIC_* env vars — they are
 * public information printed on the page, so exposing them to the browser is
 * correct. Never put a secret in a NEXT_PUBLIC_ variable.
 *
 * @param {{ variant?: 'full'|'compact' }} props
 */
export default function PaymentNote({ variant = 'full' }) {
  const pickup = process.env.NEXT_PUBLIC_PICKUP_LOCATION || 'Honiara, Solomon Islands';
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP || '';

  if (variant === 'compact') {
    return (
      <aside className="border border-bbRose/25 bg-bbRose/[0.06] p-4">
        <p className="flex items-start gap-2.5 text-xs leading-relaxed text-bbInk/75">
          <Sparkle size={11} className="mt-0.5 shrink-0" opacity={0.85} />
          <span>
            <strong className="font-semibold text-bbInk">Pay cash when you collect.</strong>{' '}
            No online card payment and no bank transfer — you send the order form, we confirm it
            with you personally.
          </span>
        </p>
      </aside>
    );
  }

  return (
    <aside className="bb-panel-burgundy p-6 sm:p-8">
      <p className="bb-eyebrow">How Payment Works</p>

      <h2 className="bb-h3 mt-4">Pay cash when you collect your order.</h2>

      <p className="bb-prose mt-4">
        There is no card checkout on this site and nothing to transfer beforehand. You send us your
        order through the form, and we reply to confirm it with you. Nothing is charged
        automatically, and we never ask for card or bank details.
      </p>

      {/* ---- 1. we confirm ---- */}
      <div className="mt-7 border-t border-bbRose/20 pt-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-editorial text-bbBlush">
          1 · We Message You
        </h3>
        <p className="mt-3 text-sm text-bbInk/75">
          We check your order, confirm the total, and tell you where and when to collect it around{' '}
          {pickup}.
        </p>
      </div>

      {/* ---- 2. her invoice ----
          Worth saying before she orders, so the private link she is given at the
          end of the form is expected rather than a surprise. */}
      <div className="mt-6 border-t border-bbRose/20 pt-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-editorial text-bbBlush">
          2 · Your Invoice
        </h3>
        <p className="mt-3 text-sm text-bbInk/75">
          You get your own link when you order. Once we have confirmed your collection, your invoice
          appears there — print it or save it as a PDF if you want a copy.
        </p>
      </div>

      {/* ---- 3. cash on collection ---- */}
      <div className="mt-6 border-t border-bbRose/20 pt-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-editorial text-bbBlush">
          3 · Cash On Collection
        </h3>
        <p className="mt-3 text-sm text-bbInk/75">
          You see the order in your hands before you pay for it. Bring the exact amount if you can —
          change is not always on hand.
        </p>
      </div>


      {whatsapp && (
        <p className="mt-6 border-t border-bbRose/20 pt-6 text-xs leading-relaxed text-bbInk/50">
          Questions before you order? Message us on WhatsApp{' '}
          <span className="text-bbBlush">{whatsapp}</span>
        </p>
      )}
    </aside>
  );
}
