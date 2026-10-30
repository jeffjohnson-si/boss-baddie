import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductArt from '@/components/ProductArt';
import ProductGallery from '@/components/ProductGallery';
import AddToBagForm from '@/components/AddToBagForm';
import PaymentNote from '@/components/PaymentNote';
import ShopTabs from '@/components/shop/ShopTabs';
import { requireShopper } from '@/lib/require-shopper';
import { CATEGORIES, formatPrice, primaryImage } from '@/lib/products';
import { getProduct, readActiveProducts } from '@/lib/product-store';

/**
 * PRODUCT PAGE — /shop/<id>
 *
 * Everything a customer needs before deciding: the photos, the full description,
 * what it fits, and the price. Rendered on the server so the page arrives as
 * finished HTML; only the gallery and the add-to-bag control ship JavaScript.
 *
 * An unknown id, or one that Patricia has archived, is a 404. Archived products
 * must not stay reachable by a shared link — that is the whole point of hiding
 * them — so this reads the ACTIVE list rather than getProduct() alone.
 */

/** Look the product up once; both the metadata and the page body need it. */
async function findVisibleProduct(id) {
  const product = await getProduct(id);
  return product && !product.archived ? product : null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await findVisibleProduct(id);

  if (!product) {
    return { title: 'Product not found', robots: { index: false, follow: false } };
  }

  const photo = primaryImage(product);

  return {
    title: product.title,
    description: product.blurb,
    openGraph: {
      title: `${product.title} | BOSS BADDIE`,
      description: product.blurb,
      type: 'website',
      // Only claim an image when a real photo exists — an OG card pointing at
      // nothing renders worse than one with no image at all.
      ...(photo ? { images: [{ url: photo, alt: product.title }] } : {}),
    },
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;

  // The shop is members-only, so a product page is too. `next` brings her back
  // to this exact product after signing in.
  await requireShopper(`/shop/${id}`);

  const product = await findVisibleProduct(id);
  if (!product) notFound();

  const category = CATEGORIES.find((c) => c.id === product.category);
  const soldOut = product.stock <= 0;
  const saving = product.compareAt ? product.compareAt - product.price : 0;

  // A short "more from the shop" strip. Same category first, then anything else,
  // so a case page suggests cases rather than a random journal.
  const others = (await readActiveProducts())
    .filter((p) => p.id !== product.id)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 4);

  return (
    <>
      <ShopTabs current="shop" />

      <section className="bb-section">
      <div className="bb-container">
        {/* ---- Breadcrumb ---- */}
        <nav aria-label="Breadcrumb" className="text-xs text-bbInk/45">
          <Link href="/shop" className="hover:text-bbRose">
            Shop
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-bbInk/70">{product.title}</span>
        </nav>

        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* ================= Pictures ================= */}
          <ProductGallery product={product} />

          {/* ================= Details ================= */}
          <div>
            {category && <p className="bb-eyebrow">{category.label}</p>}

            <h1 className="bb-h2 mt-3">{product.title}</h1>

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-3xl text-bbRose">{formatPrice(product.price)}</span>
              {product.compareAt && (
                <>
                  <span className="text-sm text-bbInk/30 line-through">
                    {formatPrice(product.compareAt)}
                  </span>
                  <span className="border border-bbRose/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-bbBlush">
                    Save ${saving}
                  </span>
                </>
              )}
            </div>

            <p className="mt-2 text-xs text-bbInk/45">
              {soldOut ? 'Sold out — message us and we will tell you when it is back.' : 'In stock in Honiara.'}
            </p>

            <p className="bb-prose mt-6">{product.description}</p>

            <AddToBagForm product={product} />

            {/* ---- Specifics ----
                No "fits" or "options" rows: a product carries no device list and
                no variant list any more. Which handset a case suits belongs in the
                description, where Patricia can word it herself. */}
            <dl className="mt-10 space-y-4 border-t border-bbLine pt-8 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="w-28 shrink-0 text-bbInk/45">Collection</dt>
                <dd className="flex-1 text-bbInk/80">
                  Collected in person — we message you a place and a time.
                </dd>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="w-28 shrink-0 text-bbInk/45">Payment</dt>
                <dd className="flex-1 text-bbInk/80">
                  Cash when you collect. No card payment, no transfer, ever.
                </dd>
              </div>
            </dl>

            <div className="mt-8">
              <PaymentNote variant="compact" />
            </div>
          </div>
        </div>

        {/* ================= More from the shop ================= */}
        {others.length > 0 && (
          <div className="mt-20 border-t border-bbLine pt-12">
            <h2 className="bb-h3">More from the shop</h2>
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-6">
              {others.map((other) => (
                <li key={other.id}>
                  <Link href={`/shop/${other.id}`} className="group block">
                    <div className="aspect-[5/6] overflow-hidden border border-bbLine">
                      <ProductArt
                        product={other}
                        className="transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <p className="mt-3 font-display text-sm text-bbInk group-hover:text-bbRose">
                      {other.title}
                    </p>
                    <p className="mt-1 text-xs text-bbRose">{formatPrice(other.price)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-14">
          <Link href="/shop" className="bb-btn-outline">
            Back To Shop
          </Link>
        </div>
      </div>
      </section>
    </>
  );
}
