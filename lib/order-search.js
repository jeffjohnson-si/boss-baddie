/**
 * Order search — the filter behind the search box on the admin dashboard.
 *
 * Browser safe: no imports, no Node built-ins. Kept out of the component so the
 * matching rules can be read (and tested) without a browser.
 *
 * Patricia searches the way she already talks to customers: by phone number, or by
 * name. Numbers are compared on DIGITS ONLY, so "+677 741 2345", "7412345" and
 * "741 2345" all find the same person, and the Solomon Islands country code is
 * ignored on both sides.
 */

/** Digits only, with a leading 677 dropped when a real number follows it. */
export function phoneDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.startsWith('677') && digits.length > 7 ? digits.slice(3) : digits;
}

/**
 * Does this order match what she typed?
 *
 * @param {object} order  the order object the dashboard already has
 * @param {string} query  whatever is in the search box
 */
export function matchesOrder(order, query) {
  const raw = String(query ?? '').trim();
  if (!raw) return true;

  const needle = raw.toLowerCase();

  // Name and order number: plain substring, case-insensitive.
  const name = String(order?.customer?.name ?? '').toLowerCase();
  const orderNumber = String(order?.orderNumber ?? '').toLowerCase();
  if (name.includes(needle) || orderNumber.includes(needle)) return true;

  // Phone: digits only, both sides normalised. Two digits is the shortest useful
  // search; one digit would match almost everything.
  const wanted = phoneDigits(raw);
  if (wanted.length < 2) return false;

  const phone = phoneDigits(order?.customer?.phone);
  return phone.includes(wanted);
}
