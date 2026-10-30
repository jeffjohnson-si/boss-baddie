'use client';

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { findProduct } from '@/lib/products';

/**
 * CartProvider — the shopping bag.
 *
 * Deliberately small: this is a manual-order store, so the cart only has to
 * survive a page reload and hand a list of line items to the order form. There
 * is no payment session to keep in sync, so localStorage is enough and costs
 * no network requests.
 *
 * Prices are NOT stored in the cart. Only productId / qty / model are kept, and
 * every price is looked up fresh from the `catalogue` the server layout passes
 * in. The server re-prices the order again on submit, so neither a tampered
 * localStorage entry nor a stale catalogue can change what a customer is charged.
 *
 * @param {{ catalogue: {id: string, title: string, price: number}[], children: React.ReactNode }} props
 */

const STORAGE_KEY = 'bb_cart_v1';
const MAX_QTY = 25; // per line — matches the server-side clamp in lib/orders.js

const CartContext = createContext(null);

/** @typedef {{ productId: string, qty: number, model: string }} CartLine */

const initialState = {
  /** @type {CartLine[]} */
  lines: [],
  /** false until the stored cart has been read, so we never render a stale empty bag */
  hydrated: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return { lines: action.lines, hydrated: true };

    case 'add': {
      const { productId, qty, model } = action;
      // Same product AND same device model = same line.
      const index = state.lines.findIndex((l) => l.productId === productId && l.model === model);

      if (index === -1) {
        return { ...state, lines: [...state.lines, { productId, qty, model }] };
      }

      const lines = [...state.lines];
      lines[index] = { ...lines[index], qty: Math.min(lines[index].qty + qty, MAX_QTY) };
      return { ...state, lines };
    }

    case 'setQty': {
      const qty = Math.min(Math.max(action.qty, 1), MAX_QTY);
      return {
        ...state,
        lines: state.lines.map((l, i) => (i === action.index ? { ...l, qty } : l)),
      };
    }

    case 'remove':
      return { ...state, lines: state.lines.filter((_, i) => i !== action.index) };

    case 'clear':
      return { ...state, lines: [] };

    default:
      return state;
  }
}

export function CartProvider({ catalogue = [], children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ---- Read the stored cart once, on mount ----
  useEffect(() => {
    let lines = [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        // Drop anything that no longer exists in the catalogue, and re-clamp qty.
        // A product Patricia has archived disappears from the bag here.
        lines = parsed
          .filter((l) => l && findProduct(catalogue, String(l.productId)))
          .map((l) => ({
            productId: String(l.productId),
            qty: Math.min(Math.max(Math.trunc(Number(l.qty) || 1), 1), MAX_QTY),
            model: String(l.model ?? '').slice(0, 120),
          }));
      }
    } catch {
      // Corrupt or blocked storage (private mode) — start with an empty bag.
      lines = [];
    }
    dispatch({ type: 'hydrate', lines });
    // Runs once: the catalogue is server-rendered, so it is already correct here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist on every change, but only after hydration ----
  useEffect(() => {
    if (!state.hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.lines));
    } catch {
      // Storage full or disabled — the cart still works for this session.
    }
  }, [state.lines, state.hydrated]);

  const value = useMemo(() => {
    // Join the stored lines against the catalogue to get titles and prices.
    const items = state.lines
      .map((line) => {
        const product = findProduct(catalogue, line.productId);
        if (!product) return null;
        return {
          ...line,
          title: product.title,
          unitPrice: product.price,
          lineTotal: product.price * line.qty,
          product,
        };
      })
      .filter(Boolean);

    return {
      items,
      hydrated: state.hydrated,
      count: items.reduce((n, i) => n + i.qty, 0),
      subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
      addItem: (productId, { qty = 1, model = '' } = {}) =>
        dispatch({ type: 'add', productId, qty, model }),
      setQty: (index, qty) => dispatch({ type: 'setQty', index, qty }),
      removeItem: (index) => dispatch({ type: 'remove', index }),
      clearCart: () => dispatch({ type: 'clear' }),
    };
  }, [state.lines, state.hydrated, catalogue]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Read the cart. Throws if used outside the provider, which is always a bug. */
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
