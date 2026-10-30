/**
 * PRODUCT CATALOGUE — shape, constants and pure helpers
 * ====================================================
 * This module is SAFE TO IMPORT FROM THE BROWSER: no Node built-ins, no disk
 * access. It holds the vocabulary of the catalogue (currency, categories), the
 * seed dataset, and pure functions over a product array.
 *
 * The live, MUTABLE catalogue lives in lib/product-store.js, which is server
 * only. Patricia adds, edits and archives products there from /admin/products,
 * and the store seeds itself from SEED_PRODUCTS below on first run.
 *
 * Every price a customer is charged is read on the SERVER from the store (see
 * buildOrder in lib/orders.js), never from the browser.
 *
 * Money is stored as a whole number of Solomon Islands dollars (SBD). There are
 * no cents in day-to-day pricing here, which avoids floating-point rounding.
 */

export const CURRENCY = 'SBD';

/**
 * Product categories — the shop sidebar and the admin form both read this list,
 * so adding a department here is the only change needed to offer it.
 *
 * The ids are stored on every product and appear in the /shop?category= URL, so
 * renaming one means re-tagging the products that use it.
 */
export const CATEGORIES = [
  { id: 'phone', label: 'Phone & Accessories' },
  { id: 'beauty', label: 'Beauty & Health' },
  { id: 'journals', label: 'Journals' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'clothing', label: 'Clothing & Fashion' },
];

/**
 * @typedef {object} Product
 * @property {string}   id         stable slug — also the key used in orders
 * @property {string}   title
 * @property {string}   blurb      one line for the product card
 * @property {string}   description longer copy for the product page
 * @property {string}   category   one of CATEGORIES[].id
 * @property {number}   price      SBD
 * @property {number|null} compareAt  original price, for a "save" badge
 * @property {number}   stock      0 = sold out
 * @property {boolean}  featured   ranked first by the default shop sort
 * @property {string[]} images     uploaded photo paths; images[0] is the primary.
 *                                 Optional — a product with none falls back to a
 *                                 plain placeholder tile (components/ProductArt.js)
 * @property {string|null} badge   short marketing label
 * @property {boolean}  archived   true = hidden from the shop, kept for restore
 *
 * A product deliberately has NO variant list, device-brand list or mockup-style
 * field. Patricia asked for those to go: anything a customer needs to specify —
 * their exact phone model, a name to print — belongs in the description and in
 * the note they leave at checkout, not in a picker she has to maintain per item.
 */

/**
 * Seed catalogue — deliberately EMPTY for launch.
 *
 * The demo catalogue was removed so nothing Patricia does not actually sell can
 * ever appear in the shop. The live data is the `products` table in Postgres;
 * add real products from /admin/products.
 *
 * If you ever want starter rows again, push objects shaped like:
 *   { id, title, blurb, description, category, price, compareAt, stock,
 *     featured, images: [], badge }
 * `category` must be one of the CATEGORIES ids above.
 *
 * @type {Product[]}
 */
export const SEED_PRODUCTS = [];


/* ------------------------------------------------------------------ */
/* Pure helpers — they operate on a products array you pass in, so the */
/* same code works on the server (store) and the client (catalogue     */
/* handed down from the layout).                                       */
/* ------------------------------------------------------------------ */

/** One product by id, or undefined. Used for cart display and order re-pricing. */
export function findProduct(products, id) {
  return products.find((p) => p.id === id);
}

/**
 * The photo to show when there is only room for one: the first upload, or null
 * when the product has none and the placeholder tile should be drawn instead.
 */
export function primaryImage(product) {
  return product?.images?.[0] ?? null;
}

/**
 * Filter and sort for the shop page.
 * Called on the server from the URL query string, so a filtered shop page is
 * plain server-rendered HTML — no client-side filtering work on a cheap phone.
 *
 * Archived products are dropped here as well as at the store, so an archived
 * item can never reach the shop grid by accident.
 *
 * The sidebar offers category and sort, and nothing else. Which phones a product
 * fits belongs in its description now that products carry no device list.
 *
 * @param {Product[]} products
 * @param {{ categories?: string[], maxPrice?: number|null, sort?: string }} opts
 */
export function filterProducts(products, { categories = [], maxPrice = null, sort = 'featured' } = {}) {
  const filtered = products.filter((p) => {
    if (p.archived) return false;
    const catOk = categories.length === 0 || categories.includes(p.category);
    const priceOk = maxPrice === null || p.price <= maxPrice;
    return catOk && priceOk;
  });

  const sorted = [...filtered];
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  else if (sort === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else sorted.sort((a, b) => Number(b.featured) - Number(a.featured)); // 'featured'

  return sorted;
}

/** Format money for display, e.g. "SBD $130". */
export function formatPrice(amount) {
  return `${CURRENCY} $${amount}`;
}
