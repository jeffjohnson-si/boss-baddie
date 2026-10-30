/**
 * RATE LIMITING — a small, in-process guard on the endpoints that guess-able
 * secrets sit behind.
 *
 * WHAT THIS IS FOR
 * ----------------
 * /api/admin/session compares against a single shared password. Without a limit,
 * a script can try it a few hundred times a second and nobody would notice,
 * because there is nothing here that logs a failed attempt anywhere Patricia
 * looks. The mobile menu links to her login page, so the door is advertised.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is NOT a substitute for Cloudflare in front of the site, for three honest
 * reasons:
 *
 *   1. It counts in memory, so restarting the server forgets every count.
 *   2. It counts per process. Two instances behind a load balancer would each
 *      allow the full quota. (Today there is one instance, so this holds.)
 *   3. It trusts a forwarded-IP header, and a header can be forged by anyone
 *      talking to the origin DIRECTLY. That is why the droplet firewall must only
 *      expose 80/443 to the proxy — the header is trustworthy exactly as far as
 *      the proxy in front is.
 *
 * It is worth having anyway: it turns an unlimited online guessing attack into a
 * slow one, with no dependency and no configuration.
 */

/**
 * key -> { count, resetAt }. A fixed window rather than a sliding one: a sliding
 * window means storing every timestamp, and the extra precision buys nothing
 * when the limit is "a handful per minute".
 */
const buckets = new Map();

/** Stop the Map growing forever on a long-running server. */
function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Who is asking. Behind nginx or Cloudflare this is the real visitor; talking to
 * the origin directly it is whatever the caller claims, hence the warning above.
 *
 * @param {Request} request
 * @returns {string}
 */
export function clientKey(request) {
  const headers = request.headers;
  // Cloudflare sets this one itself and strips any inbound copy, so it is the
  // most trustworthy of the three when Cloudflare is in front.
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  // First entry is the original client; the rest are proxies it passed through.
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const real = headers.get('x-real-ip');
  if (real) return real.trim();

  // Local development, or a request with no proxy in front. Everyone shares one
  // bucket in that case, which is fine: nobody is being attacked on localhost.
  return 'unknown';
}

/**
 * Count one attempt and say whether it is allowed.
 *
 * @param {string} key      usually `${routeName}:${clientKey(request)}`
 * @param {{ limit: number, windowMs: number }} options
 * @returns {{ ok: boolean, remaining: number, retryAfter: number }}
 *   retryAfter is whole seconds, ready for the Retry-After header.
 */
export function hit(key, { limit, windowMs }) {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfter };
  }
  return { ok: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Forget the count for a key. Called after a SUCCESSFUL sign-in so that getting
 * it right clears the slate — otherwise Patricia mistyping her password three
 * times and then getting it right would still be one attempt from a lockout.
 */
export function reset(key) {
  buckets.delete(key);
}
