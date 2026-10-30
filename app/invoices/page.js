import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import MyInvoices from '@/components/MyInvoices';

/**
 * MY INVOICES — /invoices
 *
 * The customer's own invoices, in one place. The shell is a server component so
 * the page costs nothing to render; the list itself is client-side because it
 * lives in her browser (see components/MyInvoices.js and lib/my-invoices.js).
 *
 * WHY THERE IS NO SERVER-SIDE LIST: a shop customer has no account, so there is
 * no "who is asking?" to answer. The server holds no session for her, keeps no
 * index of customers, and deliberately has no route that lists orders — the
 * invoice token she was given is the whole authorisation. This page therefore
 * shows the tokens *this device* has been handed, which is also why it survives
 * nothing but a browser's own storage.
 *
 * The route is noindex: the page is empty to a search engine, and a customer's
 * invoices are nobody else's business.
 */

export const metadata = {
  title: 'My Invoices',
  description:
    'The BOSS BADDIE invoices you have been given, on this device. Nothing to sign in to.',
  robots: { index: false, follow: false },
};

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Your Orders"
        title="Every invoice you have been given, in one place."
        intro="Nothing to sign in to — this list is kept on the device you ordered from. Open an invoice to see whether Patricia has arranged your collection yet."
      />

      <section className="bb-section">
        <div className="bb-container">
          <div className="mx-auto max-w-3xl">
            {/* Accounts came later, and they are the better answer. This page is
                kept for two honest reasons: links handed out before accounts
                existed, and a customer who has not signed up yet. */}
            <div className="mb-10 border border-bbRose/25 bg-bbRose/[0.06] p-5">
              <p className="bb-label">Have an account?</p>
              <p className="mt-2 text-sm leading-relaxed text-bbInk/75">
                Your orders, invoices and collection details live in{' '}
                <Link href="/account" className="text-bbRose underline-offset-4 hover:underline">
                  your account
                </Link>{' '}
                now — on any phone you sign in from. This page is the older, device-only
                list for links you were given before that existed.
              </p>
            </div>

            <MyInvoices />
          </div>
        </div>
      </section>
    </>
  );
}
