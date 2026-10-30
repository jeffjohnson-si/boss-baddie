import { cookies } from 'next/headers';
import { CUSTOMER_COOKIE, readCustomerToken } from '@/lib/customer-auth';
import { getCustomerById } from '@/lib/customers';

/**
 * Who is signed in to the shop, on the server.
 *
 * Used by the account pages, the checkout gate and every order route, so there is
 * exactly one answer to "which customer is this?" — never a client-supplied id.
 *
 * DELIBERATELY NOT WRAPPED IN React cache(). It looks like an obvious optimisation
 * (the layout, the page and the header all ask), and in a route handler it is
 * actively dangerous: the cached value can outlive the request, which would answer
 * one customer's request with the previous customer's identity. A second read of
 * one row is a cheap price for never mixing two people up.
 *
 * The record is re-read for every request, so an account deleted by hand stops
 * working on her next page rather than when her 60-day cookie finally expires.
 * The cookie also carries session_version: a password change or an
 * admin-issued temporary password increments it and signs older devices out.
 *
 * @returns {Promise<{id:string,name:string,phone:string,phoneDisplay:string,location:string,email:string,sessionVersion:number}|null>}
 */
export async function currentCustomer() {
  const store = await cookies();
  const token = readCustomerToken(store.get(CUSTOMER_COOKIE)?.value);
  if (!token) return null;

  const customer = await getCustomerById(token.customerId);
  if (!customer) return null;

  if (Number(token.sessionVersion) !== Number(customer.sessionVersion)) return null;

  return customer;
}
