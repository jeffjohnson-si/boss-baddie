import { Suspense } from 'react';
import PageHeader from '@/components/PageHeader';
import ShopTabs from '@/components/shop/ShopTabs';
import ShopFilters from '@/components/ShopFilters';
import ProductCard from '@/components/ProductCard';
import PaymentNote from '@/components/PaymentNote';
import { requireShopper } from '@/lib/require-shopper';
import { filterProducts } from '@/lib/products';
import { readActiveProducts } from '@/lib/product-store';

export const metadata = {
  title: 'Shop',
  description:
    'Pieces for the woman building something — stocked and made to order in Honiara. Collect in person and pay cash.',
};


/**
 * SHOP PAGE
 *
 * Filtering happens HERE, on the server, from the URL query string. The browser
 * receives already-filtered HTML, which is the cheapest possible option on a
 * slow connection and a low-end phone.
 *
 * Grid: 2 columns on mobile, 4 on desktop, with the filter sidebar to the left
 * from `lg` upward and collapsed into a <details> below that.
 *
 * @param {{ searchParams: Promise<Record<string, string|string[]|undefined>> }} props
 */
export default async function ShopPage({ searchParams }) {
  // The shop is members-only: browsing, product pages and ordering all need an
  // account. Signed out, she goes to sign in and comes straight back to the shop.
  await requireShopper('/shop');

  // Next.js 15 hands searchParams over as a Promise. Reading it synchronously
  // logs a "should be awaited" error and will stop working in a future major.
  const query = await searchParams;

  // Query strings are user input: split, drop blanks, and let the catalogue
  // helper ignore anything that is not a real category id. A repeated query
  // parameter (?category=phone&category=beauty) arrives as an array, so join it
  // before splitting rather than calling .split() on an array.
  const categoryParam = Array.isArray(query?.category)
    ? query.category.join(',')
    : query?.category;
  const sortParam = Array.isArray(query?.sort) ? query.sort[0] : query?.sort;
  const categories = categoryParam?.split(',').filter(Boolean) ?? [];
  const sort = sortParam ?? 'featured';

  // Archived products never reach here — readActiveProducts drops them, and
  // filterProducts drops them again as a second line of defence.
  const active = await readActiveProducts();
  const products = filterProducts(active, { categories, sort });
  // An empty catalogue and an over-tight filter both show zero cards but mean
  // different things, so they get different messages. "Clear a filter" is useless
  // advice when Patricia simply has not added anything yet.
  const catalogueEmpty = active.length === 0;

  // How many live products sit in each category. The sidebar uses this to offer
  // only filters that lead somewhere: a chip for a category she does not stock
  // yet reads as a broken filter, because ticking it always returns nothing.
  const categoryCounts = {};
  for (const product of active) {
    categoryCounts[product.category] = (categoryCounts[product.category] ?? 0) + 1;
  }


  return (
    <>
      <PageHeader
        eyebrow="The Shop"
        title="Protection and pieces for the woman building something."
        intro="Everything is made to order or stocked here in Honiara. Send your order, and we will confirm it with you personally."
      />

      <ShopTabs current="shop" />

      <section className="bb-section">
        <div className="bb-container">
          <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
            {/* ---------- Sidebar ---------- */}
            <aside>
              {/* No filters worth showing when there is nothing to filter. */}
              {!catalogueEmpty && (
                // ShopFilters reads useSearchParams, which must sit inside
                // Suspense so the rest of the page can still be prerendered.
                <Suspense fallback={<div className="h-12 border-b border-bbLine" />}>
                  <ShopFilters resultCount={products.length} categoryCounts={categoryCounts} />
                </Suspense>
              )}


              <div className="mt-8">
                <PaymentNote variant="compact" />
              </div>
            </aside>

            {/* ---------- Product grid ---------- */}
            <div>
              {/* Each card's title is an h3. Without this the grid is a run of h3s
                  directly under the page's h1, which reads as a skipped level.
                  Hidden visually because the page heading already says "Shop". */}
              <h2 className="sr-only">Products</h2>

              {catalogueEmpty ? (
                <p className="bb-prose">
                  The shop is being stocked right now. Message us on WhatsApp and tell us what you
                  are looking for — we will let you know the moment it is up.
                </p>
              ) : products.length === 0 ? (
                <p className="bb-prose">
                  Nothing matches that combination yet. Clear a filter, or message us — if we can get
                  it for you, we will.
                </p>

              ) : (
                <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
