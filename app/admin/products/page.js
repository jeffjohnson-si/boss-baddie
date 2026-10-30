import { redirect } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import AdminNav from '@/components/admin/AdminNav';
import ProductsAdmin from '@/components/admin/ProductsAdmin';
import { currentAdmin } from '@/lib/current-admin';
import { getProductStats, readProducts } from '@/lib/product-store';


export const metadata = {
  title: 'Products',
  robots: { index: false, follow: false }, // never let this into a search index
};

// The catalogue changes from this very page, so it must never be cached.
export const dynamic = 'force-dynamic';

/**
 * ADMIN PRODUCTS — Patricia's catalogue.
 *
 * Same rule as the orders dashboard: the authorisation check happens HERE, in a
 * server component, before any data is read. An unauthenticated request is
 * redirected and never receives the catalogue at all.
 */
export default async function AdminProductsPage() {
  if (!(await currentAdmin())) {
    redirect('/admin/login');
  }

  const [products, stats] = await Promise.all([readProducts(), getProductStats()]);

  return (
    <section className="bb-section !pt-10">
      <div className="bb-container">
        {/* ---- Header ---- */}
        <header className="flex flex-col gap-6 border-b border-bbLine pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo size="md" />
            <h1 className="bb-h2 mt-5">Products</h1>
            <p className="mt-2 text-sm text-bbInk/50">
              {stats.live} in the shop · {stats.soldOut} sold out · {stats.archived} hidden
            </p>
          </div>

          <AdminNav current="/admin/products" viewHref="/shop" viewLabel="View shop" />

        </header>

        <p className="mt-6 max-w-2xl text-sm text-bbInk/50">
          Anything you change here is live on the shop straight away. Hiding a product takes it off
          the shop but keeps the record, so you can put it back — and orders already placed are never
          affected, because each order stores its own copy of the title and price.
        </p>

        <div className="mt-8">
          <ProductsAdmin products={products} />
        </div>
      </div>
    </section>
  );
}
