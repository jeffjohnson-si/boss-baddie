import PageHeader from '@/components/PageHeader';
import ShopTabs from '@/components/shop/ShopTabs';
import OrderHistory from '@/components/OrderHistory';
import { requireShopper } from '@/lib/require-shopper';
import { readOrdersForCustomer } from '@/lib/orders';

/**
 * MY INVOICES — /shop/invoices
 *
 * Inside the shop, beside the products, because that is where a customer looks for
 * what she has already bought. Same data as the account page, from the same query
 * (`readOrdersForCustomer`), so the two cannot disagree.
 *
 * Gated like the rest of the shop: signed out, she is sent to sign in and comes
 * straight back here.
 */

export const metadata = {
  title: 'My Invoices',
  description: 'Every BOSS BADDIE order you have placed, with its invoice.',
  robots: { index: false, follow: false },
};

export default async function ShopInvoicesPage() {
  const customer = await requireShopper('/shop/invoices');
  const orders = await readOrdersForCustomer(customer.id);

  return (
    <>
      <PageHeader
        eyebrow="The Shop"
        title="My invoices."
        intro="Every order you have placed, with the invoice Patricia completes once your collection is arranged."
      />

      <ShopTabs current="invoices" />

      <section className="bb-section">
        <div className="bb-container">
          <div className="mx-auto max-w-3xl">
            {orders.length > 0 && (
              <p className="text-xs uppercase tracking-[0.18em] text-bbInk/40">
                {orders.length} order{orders.length === 1 ? '' : 's'} · newest first
              </p>
            )}

            <OrderHistory orders={orders} />

            <p className="mt-8 text-xs leading-relaxed text-bbInk/35">
              Money is settled in cash when you collect. Nothing is charged online, and no card or
              bank details are ever asked for.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
