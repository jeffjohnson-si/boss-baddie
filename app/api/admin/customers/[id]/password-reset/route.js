import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { resetCustomerPasswordByAdmin } from '@/lib/customers';
import { hashPassword } from '@/lib/customer-auth';
import { clientKey, hit } from '@/lib/rate-limit';

/**
 * POST /api/admin/customers/:id/password-reset
 *
 * Patricia generates a temporary password for a customer who cannot sign in.
 * It is returned ONCE in this response, never logged and never stored in plain
 * text. She sends it to the customer privately (WhatsApp), and the customer
 * changes it after signing in.
 *
 * Every older cookie for that customer stops working because the reset
 * increments customers.session_version.
 */

const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

/** 14 characters from an alphabet without I, l, 1, O or 0, so it is easy to read. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function temporaryPassword(length = 14) {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return value;
}

export async function POST(request, { params }) {
  const admin = await currentAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }

  const gate = hit(`admin-customer-reset:${admin.id}:${clientKey(request)}`, {
    limit: LIMIT,
    windowMs: WINDOW_MS,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Too many resets. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  const { id } = await params;
  const password = temporaryPassword();

  let customer;
  try {
    customer = await resetCustomerPasswordByAdmin(id, hashPassword(password));
  } catch (err) {
    console.error('[api/admin/customers/:id/password-reset]', err.message);
    return NextResponse.json(
      { ok: false, error: 'Could not reset that password. Try again.' },
      { status: 500 },
    );
  }

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer not found.' }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      password,
      customer: {
        id: customer.id,
        name: customer.name,
        phoneDisplay: customer.phoneDisplay,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
