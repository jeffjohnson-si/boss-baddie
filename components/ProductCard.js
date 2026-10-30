'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ProductArt from '@/components/ProductArt';
import { formatPrice } from '@/lib/products';
import { useCart } from '@/components/CartProvider';

/**
 * ProductCard — photo, title, price, and two ways to act on it.
 *
 * The WHOLE CARD opens /shop/<id>. That is done with a stretched overlay link
 * rather than by wrapping the card in an <a>, because a link may not contain a
 * button: nesting them produces invalid HTML and unpredictable clicks. The
 * overlay sits at z-10 and the actions below it at z-20, so a button wins where
 * they overlap and the rest of the card navigates.
 *
 * Every card offers the same pair, so nobody has to work out why one card looks
 * different from the one beside it:
 *   Order Now   -> adds it and goes straight to the order form
 *   Add To Bag  -> adds it and leaves her on the grid to keep shopping
 *
 * Both add straight from the grid. Products used to carry a list of phone models,
 * which meant a card sometimes had to send her to the product page to pick one
 * first; that field is gone, so there is nothing left to choose here. Sold out
 * replaces the pair with one dead button.
 *
 * Buying is still manual — /checkout is an order form, not a card payment — which
 * is why the label says "Order Now" rather than "Buy Now": nothing is charged, it
 * only skips the extra tap.
 *
 * A client component for the add-to-bag interaction. Kept small so the JS cost
 * per card stays low even when twelve of them render on the shop page.
 */
export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const soldOut = product.stock <= 0;
  const href = `/shop/${product.id}`;

  function handleAdd() {
    if (soldOut) return;
    addItem(product.id, { qty: 1 });
    setAdded(true);
    // Reset the label so the button stays usable for a second add.
    window.setTimeout(() => setAdded(false), 1800);
  }

  function handleOrderNow() {
    if (soldOut) return;
    addItem(product.id, { qty: 1 });
    router.push('/checkout');
  }

  return (
    <article className="bb-card group relative flex flex-col">
      {/* Stretched link: covers the card, sits under the action below. */}
      <Link
        href={href}
        aria-label={`View ${product.title}`}
        className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bbRose"
      />

      {/* ---- Product photo ---- */}
      <div className="relative aspect-[5/6] overflow-hidden border-b border-bbLine">
        <ProductArt product={product} className="transition-transform duration-500 group-hover:scale-[1.03]" />

        {product.badge && !soldOut && (
          <span className="absolute left-0 top-3 bg-bbRose px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-black">
            {product.badge}
          </span>
        )}

        {product.compareAt && !soldOut && (
          <span className="absolute right-3 top-3 border border-bbRose/40 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-bbBlush">
            Save ${product.compareAt - product.price}
          </span>
        )}

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <span className="bb-chip">Sold Out</span>
          </div>
        )}
      </div>

      {/* ---- Details ---- */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Both text blocks are clamped to two lines so a long title cannot make
            one card taller than its neighbours. */}
        <h3 className="line-clamp-2 font-display text-base leading-snug text-bbInk transition-colors group-hover:text-bbRose sm:text-lg">
          {product.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-bbInk/50 sm:text-sm">{product.blurb}</p>

        {/* ---- Footer ----
            mt-auto pins this block to the bottom of the card, and everything in
            it is exactly one line tall (price) or a fixed pair of buttons. That is
            what keeps the buttons on one line across a row no matter how long the
            titles above them run.
            relative + z-20 lifts the buttons above the stretched link. */}
        <div className="relative z-20 mt-auto pt-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg text-bbRose">{formatPrice(product.price)}</span>
            {product.compareAt && (
              <span className="text-xs text-bbInk/30 line-through">{formatPrice(product.compareAt)}</span>
            )}
          </div>

          {/* Stacked rather than side by side: at four cards across there is not
              room for two uppercase labels on one line. */}
          <div className="mt-4 flex flex-col gap-2">
            {soldOut ? (
              <button
                type="button"
                disabled
                className="bb-btn-solid w-full !min-h-[48px] !px-4 cursor-not-allowed opacity-40"
              >
                Sold Out
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleOrderNow}
                  className="bb-btn-solid w-full !min-h-[48px] !px-4"
                >
                  Order Now
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="bb-btn-outline w-full !min-h-[48px] !px-4"
                >
                  {added ? 'Added' : 'Add To Bag'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
