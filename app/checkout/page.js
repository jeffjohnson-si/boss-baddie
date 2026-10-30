import { redirect } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import CheckoutClient from '@/components/CheckoutClient';
import { currentCustomer } from '@/lib/current-customer';

/**
 * CHECKOUT — a manual order form, not a payment page.
 *
 * AN ACCOUNT IS REQUIRED TO ORDER. That is a deliberate policy change, made so an
 * order can be tied to a person rather than to one browser's memory: without it,
 * her invoices vanish when she changes phone.
 *
 * The gate lives HERE, in a server component, so the form is never even rendered
 * for a signed-out visitor — the redirect happens before any order data is read.
 * The API route checks again, because a redirect protects the page and not the
 * endpoint.
 *
 * Her saved details prefill the form, which is the other half of why accounts are
 * worth having on a slow connection.
 */

export const metadata = {
  title: 'Place Your Order',
  description:
    'Send your BOSS BADDIE order. No online card payment — collect in person in Honiara, Solomon Islands, and pay cash.',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const customer = await currentCustomer();
  if (!customer) redirect('/account/login?next=/checkout');

  return (
    <>
      <PageHeader
        eyebrow="Place Your Order"
        title="No card needed. Just tell us what you want."
        intro="Send this form and nothing is charged. We reply to confirm your order, tell you where and when to collect, and you pay cash when you do."
      />

      <section className="bb-section">
        <div className="bb-container">
          <CheckoutClient customer={customer} />
        </div>
      </section>
    </>
  );
}
