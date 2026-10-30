'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/components/CartProvider';

/**
 * AddToBagForm — quantity and the two actions on a product page.
 *
 * Quantity is deliberately included here but NOT on the shop card: the card is a
 * browsing surface, this is the page where someone has decided. The 1–25 range
 * matches the clamp in CartProvider and the server-side clamp in lib/orders.js,
 * so a hand-edited value cannot get further than the nearest bound.
 *
 * There is no variant picker. Products used to carry a list of models or sizes,
 * which is gone: anything a customer needs to specify — her exact handset, a name
 * to print — goes in the note at checkout, which reaches Patricia either way.
 *
 * Both actions add the same thing; they differ only in where she lands:
 *   Order Now   -> the order form, with this in the bag
 *   Add To Bag  -> stays here, so she can go back for more
 *
 * Nothing is charged either way — /checkout is a form Patricia confirms by hand.
 *
 * @param {{ product: object }} props
 */
export default function AddToBagForm({ product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const soldOut = product.stock <= 0;

  function handleAdd() {
    if (soldOut) return;
    addItem(product.id, { qty });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  function handleOrderNow() {
    if (soldOut) return;
    addItem(product.id, { qty });
    router.push('/checkout');
  }

  return (
    <div className="mt-8">
      <label className="block max-w-[7rem]">
        <span className="bb-label">Quantity</span>
        <input
          type="number"
          min="1"
          max="25"
          value={qty}
          onChange={(e) => {
            const next = Math.trunc(Number(e.target.value));
            setQty(Number.isFinite(next) ? Math.min(Math.max(next, 1), 25) : 1);
          }}
          className="bb-input"
        />
      </label>

      {/* Side by side here, unlike the grid card: this column is wide enough for
          both labels, and the pair reads as one decision with two exits. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleOrderNow}
          disabled={soldOut}
          className="bb-btn-solid w-full !px-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {soldOut ? 'Sold Out' : 'Order Now'}
        </button>

        <button
          type="button"
          onClick={handleAdd}
          disabled={soldOut}
          className="bb-btn-outline w-full !px-4 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? 'Added To Bag' : 'Add To Bag'}
        </button>
      </div>

      {/* aria-live so the confirmation is announced, not just seen. */}
      <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-center text-xs text-bbInk/45">
        {added ? 'In your bag. Nothing has been charged.' : ''}
      </p>
    </div>
  );
}
