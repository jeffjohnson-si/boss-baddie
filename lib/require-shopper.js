import { redirect } from 'next/navigation';
import { currentCustomer } from '@/lib/current-customer';

/**
 * requireShopper — the shop is for members.
 *
 * Browsing, product pages and ordering all sit behind an account now, so this is
 * the one guard they share. It redirects BEFORE any product or order data is read,
 * and it passes the page she wanted as `next` so signing in returns her there
 * rather than dumping her on the homepage.
 *
 * The redirect is a server-side decision, and the order API checks the session
 * again on its own — a page guard protects the page, not the endpoint.
 *
 * @param {string} next  site-relative path to come back to
 * @returns {Promise<object>} the signed-in customer
 */
export async function requireShopper(next = '/shop') {
  const customer = await currentCustomer();
  if (!customer) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return customer;
}
