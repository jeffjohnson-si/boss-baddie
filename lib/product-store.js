import { unstable_cache } from 'next/cache';
import { pool } from '@/lib/db';
import { CATEGORIES } from '@/lib/products';
import { deleteUpload } from '@/lib/uploads';

/**
 * PRODUCT STORE  (server only — imports DB pool)
 * ==============================================
 * The live, editable catalogue. Patricia adds, edits and archives products from
 * /admin/products; this module is the only place that writes them.
 *
 * Client components must NEVER import this file, or server-side DB logic ends up
 * in the browser bundle. Import lib/products.js for constants and pure helpers instead.
 */

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Ceilings that keep a typo from writing nonsense into the catalogue. */
const MAX_PRICE = 100000;
const MAX_STOCK = 100000;
const MAX_IMAGES = 6;

/**
 * Convert a Postgres row (snake_case) back into the camelCase product object
 * the rest of the app expects.
 */
function mapRowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    blurb: row.blurb,
    description: row.description,
    category: row.category,
    price: Number(row.price), // NUMERIC comes back as a string from pg
    compareAt: row.compare_at ? Number(row.compare_at) : null,
    stock: row.stock,
    featured: row.featured,
    badge: row.badge,
    images: row.images || [],
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every product, archived ones included. */
export async function readProducts() {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at');
  return rows.map(mapRowToProduct);
}

/** Only what customers should see. The shop and the cart both use this. */
export async function readActiveProducts() {
  const { rows } = await pool.query('SELECT * FROM products WHERE NOT archived ORDER BY created_at');
  return rows.map(mapRowToProduct);
}

/**
 * The catalogue the cart needs, cached across requests.
 *
 * WHY: the root layout reads the catalogue on EVERY page so the bag can clamp
 * quantities and show titles — including pages that never touch a product. That
 * is a database round trip on every navigation, and from a region far from the
 * database it is the largest single cost of opening a page.
 *
 * Only the four fields the bag renders are kept, so the cache stays small.
 *
 * Tagged 'products': every admin mutation calls revalidateTag('products'), and
 * the 5-minute window is a backstop in case one path forgets. Staleness here is
 * cosmetic — checkout re-reads and re-prices every line from the database — so a
 * briefly stale title or price can never change what a customer is charged.
 */
export const readCartCatalogue = unstable_cache(
  async () => {
    const products = await readActiveProducts();
    return products.map(({ id, title, price, images }) => ({ id, title, price, images }));
  },
  ['cart-catalogue'],
  { tags: ['products'], revalidate: 300 },
);

/**
 * One product by id, archived included.
 * buildOrder uses this deliberately: if an item is archived while it sits in
 * someone's bag, we would rather price and accept the order than lose the sale.
 */
export async function getProduct(id) {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return mapRowToProduct(rows[0]);
}

/** URL-safe id from a title: "Manifest Case — Blush" -> "manifest-case-blush". */
function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * An uploaded image path must be one we produced. Anything else — a traversal
 * attempt, a path outside /uploads, or a random external URL — is rejected rather
 * than written into the catalogue and rendered back to every visitor.
 *
 * With Cloudinary configured, the delivery URL for our own cloud is accepted too.
 */
function cleanImagePath(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(raw)) return raw;

  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloud) {
    const prefix = `https://res.cloudinary.com/${cloud}/image/upload/`;
    if (raw.startsWith(prefix)) {
      const rest = raw.slice(prefix.length);
      return /^(?:v\d+\/)?uploads\/[A-Za-z0-9._-]+$/.test(rest) ? raw : null;
    }
  }

  return null;
}

/** Clean a whole gallery: drop anything invalid, de-duplicate, cap the length. */
function cleanImageList(value) {
  const list = Array.isArray(value) ? value : [];
  const cleaned = list.map(cleanImagePath).filter(Boolean);
  return [...new Set(cleaned)].slice(0, MAX_IMAGES);
}

/**
 * Validate and normalise a product payload from the admin form.
 */
export function buildProduct(payload, { existing = null, products = [] } = {}) {
  const errors = [];

  const title = String(payload?.title ?? '').trim();
  const blurb = String(payload?.blurb ?? '').trim();
  const description = String(payload?.description ?? '').trim();
  const category = CATEGORY_IDS.includes(payload?.category) ? payload.category : null;
  const badge = String(payload?.badge ?? '').trim();

  const price = Math.trunc(Number(payload?.price));
  const hasCompareAt = payload?.compareAt !== '' && payload?.compareAt !== null && payload?.compareAt !== undefined;
  const compareAt = hasCompareAt ? Math.trunc(Number(payload.compareAt)) : null;
  const stock = Math.trunc(Number(payload?.stock ?? 0));

  if (title.length < 2) errors.push('Give the product a title.');
  if (title.length > 120) errors.push('Shorten the title to 120 characters or less.');
  if (blurb.length < 2) errors.push('Write a one-line blurb for the product card.');
  if (blurb.length > 200) errors.push('Shorten the blurb to 200 characters or less.');
  if (description.length > 2000) errors.push('Shorten the description to 2000 characters or less.');
  if (!category) errors.push(`Choose a category: ${CATEGORY_IDS.join(', ')}.`);
  if (badge.length > 40) errors.push('Shorten the badge to 40 characters or less.');

  if (!Number.isFinite(price) || price < 1 || price > MAX_PRICE) {
    errors.push(`Price must be a whole number between 1 and ${MAX_PRICE} SBD.`);
  }
  if (compareAt !== null) {
    if (!Number.isFinite(compareAt) || compareAt < 1 || compareAt > MAX_PRICE) {
      errors.push('The "was" price must be a whole number, or left blank.');
    } else if (Number.isFinite(price) && compareAt <= price) {
      errors.push('The "was" price has to be higher than the price, or left blank.');
    }
  }
  if (!Number.isFinite(stock) || stock < 0 || stock > MAX_STOCK) {
    errors.push(`Stock must be a whole number between 0 and ${MAX_STOCK}.`);
  }

  if (errors.length > 0) return { ok: false, errors };

  // Ids are derived from the title but never change once set, so past orders and
  // any link a customer has already shared keep pointing at the same product.
  let id = existing?.id;
  if (!id) {
    const base = slugify(title) || 'product';
    id = `bb-${base}`;
    let n = 2;
    while (products.some((p) => p.id === id)) {
      id = `bb-${base}-${n}`;
      n += 1;
    }
  }

  return {
    ok: true,
    product: {
      id,
      title,
      blurb,
      description: description || blurb,
      category,
      price,
      compareAt,
      stock,
      featured: Boolean(payload?.featured),
      images: cleanImageList(payload?.images),
      badge: badge || null,
      archived: Boolean(existing?.archived),
    },
  };
}

/** Add a product. Returns the stored record. */
export async function insertProduct(product) {
  const { rows } = await pool.query(
    `INSERT INTO products (id, title, blurb, description, category, price, compare_at, stock, featured, badge, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      product.id, product.title, product.blurb, product.description,
      product.category, product.price, product.compareAt, product.stock,
      product.featured, product.badge, product.images
    ]
  );
  return mapRowToProduct(rows[0]);
}

/** Replace a product in place. Returns the stored record, or null if unknown. */
export async function replaceProduct(id, product) {
  // `archived` is deliberately absent: an edit must never un-hide a product.
  const { rows } = await pool.query(
    `INSERT INTO products (id, title, blurb, description, category, price, compare_at, stock, featured, badge, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       blurb = EXCLUDED.blurb,
       description = EXCLUDED.description,
       category = EXCLUDED.category,
       price = EXCLUDED.price,
       compare_at = EXCLUDED.compare_at,
       stock = EXCLUDED.stock,
       featured = EXCLUDED.featured,
       badge = EXCLUDED.badge,
       images = EXCLUDED.images
     RETURNING *`,
    [
      product.id, product.title, product.blurb, product.description,
      product.category, product.price, product.compareAt, product.stock,
      product.featured, product.badge, product.images
    ]
  );
  return mapRowToProduct(rows[0]);
}

/**
 * Hide a product from the shop, or bring it back.
 */
export async function setProductArchived(id, archived) {
  const { rows } = await pool.query(
    'UPDATE products SET archived = $2 WHERE id = $1 RETURNING *',
    [id, Boolean(archived)]
  );
  return mapRowToProduct(rows[0]);
}

/**
 * Delete a product for good. Only allowed if already archived.
 */
export async function deleteProduct(id) {
  const { rows } = await pool.query(
    'DELETE FROM products WHERE id = $1 AND archived RETURNING *',
    [id]
  );

  if (rows.length === 0) {
    // We didn't delete anything. Find out why (doesn't exist, or not archived?)
    const check = await pool.query('SELECT archived FROM products WHERE id = $1', [id]);
    if (check.rows.length === 0) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'not_archived' };
  }

  const product = mapRowToProduct(rows[0]);

  // After the record is gone, so a failure here cannot leave a half-deleted product.
  for (const image of product.images ?? []) {
    await deleteUpload(image);
  }

  return { ok: true, product };
}

/** Counters for the admin products header. */
export async function getProductStats() {
  const { rows } = await pool.query(`
    SELECT 
      count(*) FILTER (WHERE NOT archived) AS live,
      count(*) FILTER (WHERE archived) AS archived,
      count(*) FILTER (WHERE NOT archived AND stock = 0) AS sold_out
    FROM products
  `);
  
  const stats = rows[0];
  return {
    live: parseInt(stats.live, 10),
    archived: parseInt(stats.archived, 10),
    soldOut: parseInt(stats.sold_out, 10),
  };
}

