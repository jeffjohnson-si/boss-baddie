import { NextResponse } from 'next/server';
import { buildOrder, insertOrder, invoicePath, OutOfStockError } from '@/lib/orders';
import { currentCustomer } from '@/lib/current-customer';
import { clientKey, hit } from '@/lib/rate-limit';

const ORDER_LIMIT = 10;
const ORDER_WINDOW_MS = 15 * 60 * 1000;

/**
 * POST /api/orders — create a manual order request.
 *
 * There is no payment step here, by design. The customer submits the form, we
 * store the order as status "new", and the money changes hands in cash when she
 * collects — there is nothing to charge and nothing to transfer.
 *
 * Every price is recalculated server-side inside buildOrder(), so the client
 * cannot dictate any total.
 *
 * Responses
 *   201 { ok: true, order }        created
 *   400 { ok: false, errors }      body was not valid JSON
 *   422 { ok: false, errors }      validation failed
 *   500 { ok: false, errors }      could not persist
 */
export async function POST(request) {
  // Sign-in is checked BEFORE the rate limit is counted, so a signed-out visitor
  // cannot burn a real customer's quota by hammering the endpoint.
  const customer = await currentCustomer();
  if (!customer) {
    // 401 rather than 403: the fix is to sign in, and the client says so.
    return NextResponse.json(
      { ok: false, signIn: true, errors: ['Please sign in to place an order.'] },
      { status: 401 },
    );
  }

  const gate = hit(`order-submit:${clientKey(request)}`, {
    limit: ORDER_LIMIT,
    windowMs: ORDER_WINDOW_MS,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, errors: ['Too many order attempts from here. Please try again later.'] },
      { status: 429, headers: { 'Retry-After': String(gate.retryAfter) } },
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const result = await buildOrder(payload);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  // The account, not the form, decides who owns the order. Her name and phone are
  // still snapshotted onto the order itself, so Patricia's sheet and the printed
  // invoice read exactly as they did before accounts existed.
  result.order.customerId = customer.id;

  try {
    const order = await insertOrder(result.order);

    // Just enough for the confirmation screen, plus the private link to her own
    // invoice. The invoice itself is NOT returned here: it is only worth showing
    // once Patricia has arranged the collection, so /invoice/<token> renders it
    // from the store instead — which also means she can come back to it later.
    //
    // The token goes straight back to the browser that submitted the order, so no
    // one else learns it here. There is no route that finds an order by number.
    return NextResponse.json(
      {
        ok: true,
        order: {
          orderNumber: order.orderNumber,
          total: order.total,
          currency: order.currency,
          invoiceUrl: invoicePath(order),
        },
      },
      { status: 201 },
    );

  } catch (err) {
    // Stock ran out between validation and the write, or another order took the
    // last unit at the same moment. Explain it against the line that changed.
    if (err instanceof OutOfStockError) {
      return NextResponse.json(
        {
          ok: false,
          errors: err.unavailable.map(({ title, available }) =>
            available > 0
              ? `Only ${available} × ${title} left. Please update your bag.`
              : `${title} just sold out. Please remove it from your bag.`,
          ),
        },
        { status: 422 },
      );
    }

    console.error('[api/orders] failed to save order:', err);
    return NextResponse.json(
      {
        ok: false,
        errors: [
          'We could not save your order. Please message us on WhatsApp and we will take it down manually.',
        ],
      },
      { status: 500 },
    );
  }
}
