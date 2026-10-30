import { NextResponse } from 'next/server';
import { currentCustomer } from '@/lib/current-customer';
import { updateCustomerProfile } from '@/lib/customers';

/**
 * PATCH /api/account/profile — change name, location or contact email.
 *
 * The customer is ALWAYS the one in the session cookie. There is no id in the URL
 * or the body, so a member cannot edit anybody else's account by changing a
 * number in the request. The phone number is not editable here: it is the login
 * handle, and changing it would have to move the session with it.
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
