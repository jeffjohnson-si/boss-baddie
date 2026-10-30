/**
 * MY INVOICES — the customer's own list of the invoices she has been given
 * ========================================================================
 * This module is SAFE TO IMPORT FROM THE BROWSER: no Node built-ins, no
 * filesystem, no network. Everything it touches is window.localStorage.
 *
 * WHY THIS EXISTS
 *   A shop customer has no account. She gives a name, a phone number and often
 *   no email, so there is nothing to sign in to and — by design — no server
 *   route that lists orders. Her invoice link is the whole authorisation.
 *
 *   That left her with exactly one copy of that link: the confirmation screen
 *   she was looking at when she ordered. Miss it, and the invoice was gone
 *   unless Patricia happened to message it to her again.
 *
 *   So the browser keeps its own record of the tokens it has been handed. This
 *   is not a new database and not an account: it is the same trade the shopping
 *   bag already makes with localStorage (see components/CartProvider.js). The
 *   server still cannot list anybody's orders, and no personal detail is stored
 *   here — an order number, an amount, a date and the token she already holds.
 *
 * WHAT IT IS NOT
 *   - Not a security boundary. The token was, and still is, the secret. Holding
 *     a list of tokens locally grants no access a customer did not already have.
 *   - Not a backup. Clearing site data, a private window, or a different phone
 *     starts an empty list, which is why the page offers "add a link by hand"
 *     and the confirmation screen still tells her to copy or bookmark her link.
 */

export const INVOICES_STORAGE_KEY = 'bb_invoices_v1';

/** Enough history to be useful; small enough to survive a quota-limited phone. */
const MAX_INVOICES = 40;

/**
 * An invoice token is 24 random bytes as base64url (see lib/orders.js), so 32
 * characters of [A-Za-z0-9_-]. The lower bound of 20 keeps a truncated paste
 * working while still rejecting words and order numbers.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,}$/;

/** "BB-20261028-4817" — printed on paper, and NOT enough to open an invoice. */
const ORDER_NUMBER_PATTERN = /^BB-\d{8}-\d{3,6}$/i;

/** localStorage, or null when the browser refuses it (private mode, blocked). */
function storage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Whether a list can be kept at all here. The page asks before promising to save
 * something: a blocked browser should say so, not show a row that disappears on
 * the next reload.
 */
export function storageAvailable() {
  return storage() !== null;
}

/**
 * Turn whatever the customer pasted into a bare token.
 *
 * Accepts a full link ("https://…/invoice/<token>"), a path
 * ("/invoice/<token>") or the token on its own. Returns null for anything else,
 * including an order number — that value is short and guessable, so it must
 * never be treated as authorisation.
 */
export function parseInvoiceToken(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  if (TOKEN_PATTERN.test(raw)) return raw;

  const fromUrl = raw.match(/\/invoice\/([A-Za-z0-9_-]{20,})/);
  return fromUrl ? fromUrl[1] : null;
}

/** True when the input is an order reference, so the UI can say so precisely. */
export function looksLikeOrderNumber(input) {
  return ORDER_NUMBER_PATTERN.test(String(input ?? '').trim());
}

/** The private route for a token. Server-rendered; nothing else is needed. */
export function invoiceUrlFor(token) {
  return `/invoice/${token}`;
}

function isoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Keep only fields we understand and can render. A hand-edited or older entry
 * degrades to the minimum rather than breaking the page.
 */
function normalise(entry) {
  const token = parseInvoiceToken(entry?.token ?? entry?.invoiceUrl);
  if (!token) return null;

  const total = Number(entry?.total);
  const itemCount = Number(entry?.itemCount);
  const orderNumber = typeof entry?.orderNumber === 'string' ? entry.orderNumber.trim() : '';

  return {
    token,
    // Absent for a link pasted by hand: we know it is her invoice, not when she
    // ordered or what it came to.
    orderNumber: orderNumber ? orderNumber.slice(0, 40) : null,
    total: Number.isFinite(total) && total > 0 ? total : null,
    currency: typeof entry?.currency === 'string' && entry.currency.trim()
      ? entry.currency.trim().slice(0, 3)
      : 'SBD',
    itemCount: Number.isFinite(itemCount) && itemCount > 0 ? Math.trunc(itemCount) : null,
    // placedAt = when the order was submitted. addedAt = when this browser first
    // heard about it (always known, and the only date a pasted link has).
    placedAt: isoOrNull(entry?.placedAt),
    addedAt: isoOrNull(entry?.addedAt) ?? new Date().toISOString(),
  };
}

/** Most recent first: the order date if we have one, otherwise when it was saved. */
function timestamp(entry) {
  return new Date(entry.placedAt ?? entry.addedAt ?? 0).getTime();
}

function persist(list) {
  const store = storage();
  if (store) {
    try {
      store.setItem(INVOICES_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Quota or a locked-down browser. The list still works for this page view;
      // it just will not survive a reload. Never worth an error in a customer's face.
    }
  }
  return list;
}

/**
 * Every invoice this browser knows about, newest first.
 * @returns {Array<{token:string, orderNumber:string|null, total:number|null, currency:string, itemCount:number|null, placedAt:string|null, addedAt:string}>}
 */
export function readMyInvoices() {
  const store = storage();
  if (!store) return [];

  try {
    const parsed = JSON.parse(store.getItem(INVOICES_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalise)
      .filter(Boolean)
      .sort((a, b) => timestamp(b) - timestamp(a))
      .slice(0, MAX_INVOICES);
  } catch {
    // Corrupt value — behave like a first visit rather than throwing at the page.
    return [];
  }
}

/**
 * Add or refresh one invoice. Called straight after a successful order, and by
 * the "add a link" form for a link from another device.
 *
 * Idempotent by token: placing the same order twice cannot create two rows, and
 * a known order keeps its earlier order number and amount if this call is the
 * thin one (a pasted link has neither).
 *
 * @param {{token?: string, invoiceUrl?: string, orderNumber?: string|null,
 *          total?: number|null, currency?: string, itemCount?: number|null,
 *          placedAt?: string|null}} entry
 * @returns {ReturnType<typeof readMyInvoices>} the list after saving
 */
export function rememberInvoice(entry) {
  const record = normalise(entry);

  // No storage means nothing was saved, so nothing is reported as saved. The
  // caller is expected to have checked storageAvailable() and told her the truth;
  // a row here that vanishes on reload would be worse than no row.
  if (!record || !storage()) return readMyInvoices();

  const existing = readMyInvoices();
  const previous = existing.find((item) => item.token === record.token) ?? null;

  const merged = {
    ...record,
    orderNumber: record.orderNumber ?? previous?.orderNumber ?? null,
    total: record.total ?? previous?.total ?? null,
    itemCount: record.itemCount ?? previous?.itemCount ?? null,
    placedAt: record.placedAt ?? previous?.placedAt ?? null,
    addedAt: previous?.addedAt ?? record.addedAt,
  };

  const list = [merged, ...existing.filter((item) => item.token !== record.token)].slice(0, MAX_INVOICES);
  return persist(list);
}

/** Forget one entry on this device. It does not cancel the order or the link. */
export function forgetInvoice(token) {
  const key = String(token ?? '');
  return persist(readMyInvoices().filter((item) => item.token !== key));
}

/** Forget the whole list on this device. Also harmless to the orders themselves. */
export function clearMyInvoices() {
  const store = storage();
  if (store) {
    try {
      store.removeItem(INVOICES_STORAGE_KEY);
    } catch {
      // Nothing to do; the next write will simply start a new list.
    }
  }
  return [];
}
