import { NextResponse } from 'next/server';
import { currentCustomer } from '@/lib/current-customer';
import { updateCustomerProfile } from '@/lib/customers';

/**
 * PATCH /api/account/profile — change name or location.
 *
 * The customer is ALWAYS the one in the session cookie. There is no id in the URL
 * or the body, so nobody can edit another account by changing a number in the
 * request. The email address is not editable here: it is the login handle, so
 * changing it has to go through a fresh code, not a form post.
 */

export async function PATCH(request) {
  const customer = await currentCustomer();
  if (!customer) {
    return NextResponse.json({ ok: false, errors: ['Please sign in again.'] }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const result = await updateCustomerProfile(customer.id, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  return NextResponse.json({ ok: true, customer: result.customer });
}
