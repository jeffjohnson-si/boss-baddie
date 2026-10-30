import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { getProduct } from '@/lib/product-store';
import {
  FULFILMENT_METHODS,
  INVOICE_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
} from '@/lib/order-constants';

/**
 * ORDER STORE  (server only — uses Postgres)
 * ==========================================
 * Orders are the only mutable data in this project. Because there is no card
 * payment, an "order" is really a manual order REQUEST that Patricia confirms
 * by hand.
 *
 * BUSINESS RULE: every order is collected in person and paid for in cash at that
 * moment.
 */

// Re-exported so existing server-side imports keep working from one place.
export { FULFILMENT_METHODS, ORDER_STATUSES, PAYMENT_METHODS };

const PICKUP_LIMITS = { place: 120, when: 80, note: 500 };

function emptyPickup() {
  return { place: '', when: '', note: '' };
}

/**
 * Convert a joined Postgres row into the camelCase order object the frontend expects.
 */
function mapRowToOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderNumber: row.order_number,
    invoiceToken: row.invoice_token,
    customerId: row.customer_id ?? null,
    status: row.status,
    invoiceStatus: row.invoice_status ?? 'pending',
    invoiceIssuedAt: row.invoice_issued_at ?? null,
    createdAt: row.created_at,
    customer: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
      location: row.customer_location,
      fulfilment: row.fulfilment,
      paymentMethod: row.payment_method,
      notes: row.notes,
    },
    subtotal: Number(row.subtotal),
    total: Number(row.total),
    currency: row.currency,
    pickup: {
      place: row.pickup_place || '',
      when: row.pickup_when || '',
      note: row.pickup_note || '',
    },
    items: row.items || [],
  };
}

function generateInvoiceToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function isInvoiceReady(order) {
  return order?.invoiceStatus === 'issued' || order?.invoiceStatus === 'paid';
}

export function invoicePath(order) {
  return `/invoice/${order.invoiceToken}`;
}

/** Read every order, newest first, with nested items. */
export async function readOrders() {
  const { rows } = await pool.query(`
    SELECT o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'productId', i.product_id, 
            'title', i.title, 
            'model', i.model,
            'qty', i.qty, 
            'unitPrice', i.unit_price, 
            'lineTotal', i.line_total
          ) ORDER BY i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS items
    FROM orders o
    LEFT JOIN order_items i ON i.order_id = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `);
  return rows.map(mapRowToOrder);
}

/**
 * One customer's own orders, newest first, with their lines.
 *
 * This is the account dashboard's source of truth. It filters on customer_id and
 * nothing else — never on a phone number or an email typed into the page, so one
 * account cannot read another's order by changing a value in the browser.
 */
export async function readOrdersForCustomer(customerId) {
  const { rows } = await pool.query(`
    SELECT o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'productId', i.product_id,
            'title', i.title,
            'model', i.model,
            'qty', i.qty,
            'unitPrice', i.unit_price,
            'lineTotal', i.line_total
          ) ORDER BY i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS items
    FROM orders o
    LEFT JOIN order_items i ON i.order_id = o.id
    WHERE o.customer_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `, [customerId]);

  return rows.map(mapRowToOrder);
}

/** Find one order by its invoice token. */
export async function readOrderByInvoiceToken(token) {
  const key = String(token ?? '');
  if (key.length < 20) return null;
  
  const { rows } = await pool.query(`
    SELECT o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'productId', i.product_id, 
            'title', i.title, 
            'model', i.model,
            'qty', i.qty, 
            'unitPrice', i.unit_price, 
            'lineTotal', i.line_total
          ) ORDER BY i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS items
    FROM orders o
    LEFT JOIN order_items i ON i.order_id = o.id
    WHERE o.invoice_token = $1
    GROUP BY o.id
  `, [key]);
  
  return mapRowToOrder(rows[0]);
}

function generateOrderNumber(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = String(crypto.randomInt(1000, 9999));
  return `BB-${y}${m}${d}-${suffix}`;
}

/** Validate and normalise an incoming order payload. */
export async function buildOrder(payload) {
  const errors = [];
  const c = payload?.customer ?? {};

  const name = String(c.name ?? '').trim();
  const phone = String(c.phone ?? '').trim();
  const email = String(c.email ?? '').trim();
  const location = String(c.location ?? '').trim();
  const notes = String(c.notes ?? '').trim();
  const fulfilment = FULFILMENT_METHODS.includes(c.fulfilment) ? c.fulfilment : 'pickup';
  const paymentMethod = PAYMENT_METHODS.includes(c.paymentMethod) ? c.paymentMethod : 'cash_on_pickup';

  if (name.length < 2) errors.push('Please enter your full name.');
  if (phone.replace(/\D/g, '').length < 6) errors.push('Please enter a reachable phone number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('That email address does not look right.');
  if (!location) errors.push('Please tell us your village, suburb or province.');
  if (notes.length > 1000) errors.push('Please shorten your note.');

  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  if (rawItems.length === 0) errors.push('Your bag is empty.');

  const items = [];
  const requestedByProduct = new Map();
  const productsById = new Map();
  for (const raw of rawItems) {
    const product = await getProduct(String(raw?.productId ?? raw?.id ?? ''));
    if (!product) {
      errors.push('One of the items is no longer available. Please review your bag.');
      continue;
    }
    const qty = Math.min(Math.max(Math.trunc(Number(raw?.qty) || 1), 1), 25);
    requestedByProduct.set(product.id, (requestedByProduct.get(product.id) ?? 0) + qty);
    productsById.set(product.id, product);
    items.push({
      productId: product.id,
      title: product.title,
      model: String(raw?.model ?? '').slice(0, 120),
      qty,
      unitPrice: product.price, // server-side price, never client-supplied
      lineTotal: product.price * qty,
    });
  }

  for (const [productId, requested] of requestedByProduct) {
    const product = productsById.get(productId);
    const available = Number.isFinite(product.stock) ? product.stock : 0;
    if (available <= 0) {
      errors.push(`${product.title} is sold out. Please remove it from your bag.`);
    } else if (requested > available) {
      errors.push(`Only ${available} ${product.title} available. Please update your quantity.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  return {
    ok: true,
    order: {
      id: `ord_${crypto.randomUUID()}`,
      orderNumber: generateOrderNumber(),
      invoiceToken: generateInvoiceToken(),
      createdAt: new Date().toISOString(),

      status: 'new',
      customer: { name, phone, email, location, fulfilment, paymentMethod, notes },
      items,
      subtotal,
      total: subtotal,
      currency: 'SBD',
      pickup: emptyPickup(),
    },
  };
}

/** Persist a validated order using a transaction. */
export async function insertOrder(order) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO orders (
        id, order_number, invoice_token, status, 
        customer_name, customer_phone, customer_email, customer_location, notes,
        fulfilment, payment_method, subtotal, total, customer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      order.id, order.orderNumber, order.invoiceToken, order.status,
      order.customer.name, order.customer.phone, order.customer.email || null, order.customer.location, order.customer.notes || null,
      order.customer.fulfilment, order.customer.paymentMethod, order.subtotal, order.total,
      // Which account placed it. Null only for orders written before accounts.
      order.customerId ?? null,
    ]);

    for (const item of order.items) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, title, model, qty, unit_price, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [order.id, item.productId, item.title, item.model, item.qty, item.unitPrice, item.lineTotal]);
    }

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[orders] transaction failed:', err);
    throw new Error('Could not persist the new order.');
  } finally {
    client.release();
  }
}

/**
 * Move the invoice itself: pending -> issued -> paid, or void.
 *
 * Issuing stamps `invoice_issued_at` the first time only, so the date she issued it
 * stays the date she issued it even if she marks it paid a week later.
 *
 * @returns the updated order, or null if the order or the status is unknown
 */
export async function setInvoiceStatus(id, status) {
  if (!INVOICE_STATUSES.includes(status)) return null;

  const { rows } = await pool.query(
    `UPDATE orders
        SET invoice_status = $2::invoice_status,
            invoice_issued_at = CASE WHEN $3 IN ('issued','paid') AND invoice_issued_at IS NULL THEN now() ELSE invoice_issued_at END,
            -- The moment the cash was in her hand. Income is reported from this
            -- column, so a week/month/year figure never has to guess.
            paid_at = CASE
              WHEN $3 = 'paid' AND paid_at IS NULL THEN now()
              -- Leaving Paid (a void, or a correction) takes the money back out
              -- of the figures, and paying again later records the new date.
              WHEN $3 <> 'paid' THEN NULL
              ELSE paid_at
            END,
            updated_at = now()
      WHERE id = $1
      RETURNING invoice_token`,
    [id, status, status],
  );

  if (rows.length === 0) return null;
  return readOrderByInvoiceToken(rows[0].invoice_token);
}

/** Update the status of one order. Returns the updated order, or null. */
export async function updateOrderStatus(id, status) {
  if (!ORDER_STATUSES.includes(status)) return null;
  
  const { rows } = await pool.query(
    'UPDATE orders SET status = $2 WHERE id = $1 RETURNING *',
    [id, status]
  );
  
  if (rows.length === 0) return null;
  // Return the full order with items by doing a quick lookup
  return readOrderByInvoiceToken(rows[0].invoice_token);
}

/** Record where and when this customer collects. */
export async function setOrderPickup(id, pickup) {
  const place = String(pickup?.place ?? '').trim().slice(0, PICKUP_LIMITS.place);
  const when = String(pickup?.when ?? '').trim().slice(0, PICKUP_LIMITS.when);
  const note = String(pickup?.note ?? '').trim().slice(0, PICKUP_LIMITS.note);

  const { rows } = await pool.query(
    `UPDATE orders 
     SET pickup_place = $2, pickup_when = $3, pickup_note = $4 
     WHERE id = $1 
     RETURNING *`,
    [id, place, when, note]
  );

  if (rows.length === 0) return null;
  return readOrderByInvoiceToken(rows[0].invoice_token);
}

/** Counters for the admin dashboard cards. */
export async function getOrderStats() {
  const { rows } = await pool.query(`
    SELECT 
      count(*) AS total,
      count(*) FILTER (WHERE status = 'new') AS new_count,
      count(*) FILTER (WHERE status = 'awaiting_payment') AS awaiting_payment,
      count(*) FILTER (WHERE status = 'completed') AS completed,
      COALESCE(sum(total) FILTER (WHERE status IN ('paid','ready','completed')), 0) AS revenue
    FROM orders
  `);
  
  const stats = rows[0];
  return {
    total: parseInt(stats.total, 10),
    new: parseInt(stats.new_count, 10),
    awaitingPayment: parseInt(stats.awaiting_payment, 10),
    completed: parseInt(stats.completed, 10),
    revenue: Number(stats.revenue),
  };
}
/**
 * Cash actually collected, by period.
 *
 * INCOME MEANS PAID INVOICES. Marking an order "paid" in the order status is a
 * separate switch, and an invoice that is pending, issued or voided is not money in
 * hand. Everything here filters on invoice_status = 'paid' and reads paid_at, which
 * setInvoiceStatus() stamps the first time the invoice is marked paid.
 *
 * Weeks start on Monday (Postgres date_trunc), which is how a shop actually counts.
 */
export async function getIncomeSummary() {
  const { rows } = await pool.query(`
    SELECT
      COALESCE(sum(total) FILTER (WHERE paid_at >= date_trunc('week',  now())), 0) AS week_total,
      COALESCE(sum(total) FILTER (WHERE paid_at >= date_trunc('month', now())), 0) AS month_total,
      COALESCE(sum(total) FILTER (WHERE paid_at >= date_trunc('year',  now())), 0) AS year_total,
      COALESCE(sum(total), 0) AS all_time_total,
      count(*) FILTER (WHERE paid_at >= date_trunc('week',  now())) AS week_count,
      count(*) FILTER (WHERE paid_at >= date_trunc('month', now())) AS month_count,
      count(*) FILTER (WHERE paid_at >= date_trunc('year',  now())) AS year_count,
      count(*) AS all_time_count
    FROM orders
    WHERE invoice_status = 'paid' AND paid_at IS NOT NULL
  `);

  const r = rows[0];
  return {
    week: Number(r.week_total),
    weekCount: Number(r.week_count),
    month: Number(r.month_total),
    monthCount: Number(r.month_count),
    year: Number(r.year_total),
    yearCount: Number(r.year_count),
    allTime: Number(r.all_time_total),
    allTimeCount: Number(r.all_time_count),
  };
}

/** Month-by-month totals for the window, oldest first — only months with income. */
export async function getMonthlyIncome(monthCount = 6) {
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('month', paid_at), 'Mon YYYY') AS label,
            date_trunc('month', paid_at) AS month_start,
            sum(total) AS total,
            count(*) AS payments
       FROM orders
      WHERE invoice_status = 'paid' AND paid_at IS NOT NULL
        AND paid_at >= date_trunc('month', now()) - ($1 - 1) * interval '1 month'
      GROUP BY 1, 2
      ORDER BY 2`,
    [monthCount],
  );

  return rows.map((row) => ({
    label: row.label,
    total: Number(row.total),
    payments: Number(row.payments),
  }));
}

/** The most recent payments, newest first. */
export async function getRecentPayments(limit = 5) {
  const { rows } = await pool.query(
    `SELECT order_number, customer_name, total, paid_at
       FROM orders
      WHERE invoice_status = 'paid' AND paid_at IS NOT NULL
      ORDER BY paid_at DESC
      LIMIT $1`,
    [limit],
  );

  return rows.map((row) => ({
    orderNumber: row.order_number,
    customerName: row.customer_name,
    total: Number(row.total),
    paidAt: row.paid_at,
  }));
}
