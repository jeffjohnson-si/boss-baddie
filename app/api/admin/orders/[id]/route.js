import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { INVOICE_STATUSES } from '@/lib/order-constants';
import { ORDER_STATUSES, setInvoiceStatus, setOrderPickup, updateOrderStatus } from '@/lib/orders';

/**
 * PATCH /api/admin/orders/:id — move an order along the workflow, or record
 * where and when the customer collects it.
 *
 * Two shapes, one per action, so a status change can never overwrite pickup
 * details by omission (and the other way round):
 *   { status: 'paid' }
 *   { pickup: { place, when, note } }
 *
 * Authorisation is checked FIRST, on the server, before the body is even read.
 * Never trust the client to tell us it is logged in. Pickup details are admin
 * only — the storefront has no route that can write them.
 *
 * Responses
 *   200 { ok: true, id, status }  or  { ok: true, id, pickup }
 *   400 invalid body or unknown status
 *   401 no valid session
 *   404 no order with that id
 */
export async function PATCH(request, { params }) {
  // ---- 1. auth ----
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }

  // Next.js 15 hands route params over as a Promise.
  const { id } = await params;


  // ---- 2. body ----
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  // ---- 3a. pickup details ----
  if (body?.pickup !== undefined) {
    if (typeof body.pickup !== 'object' || body.pickup === null || Array.isArray(body.pickup)) {
      return NextResponse.json(
        { ok: false, error: 'Pickup must be an object with place, when and note.' },
        { status: 400 },
      );
    }

    // Trimming and length caps happen in the store, so they hold for every caller.
    let updated;
    try {
      updated = await setOrderPickup(id, body.pickup);
    } catch (err) {
      console.error('[api/admin/orders/:id] failed to save collection details:', err);
      return NextResponse.json(
        { ok: false, error: 'Could not save collection details. Please try again.' },
        { status: 500 },
      );
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: updated.id, pickup: updated.pickup });
  }

  // ---- 3a2. invoice ----
  // A third shape, so issuing an invoice never overwrites the order status and
  // the other way round. The rule is simply: a submitted order is pending until
  // Patricia issues the invoice.
  if (body?.invoice !== undefined) {
    const invoice = String(body.invoice);
    if (!INVOICE_STATUSES.includes(invoice)) {
      return NextResponse.json(
        { ok: false, error: `Invoice status must be one of: ${INVOICE_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    let updated;
    try {
      updated = await setInvoiceStatus(id, invoice);
    } catch (err) {
      console.error('[api/admin/orders/:id] failed to save invoice status:', err);
      return NextResponse.json(
        { ok: false, error: 'Could not save the invoice status. Please try again.' },
        { status: 500 },
      );
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: updated.id, invoiceStatus: updated.invoiceStatus });
  }

  // ---- 3b. status ----
  const status = String(body?.status ?? '');
  if (!ORDER_STATUSES.includes(status)) {
    return NextResponse.json(
      { ok: false, error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  let updated;
  try {
    updated = await updateOrderStatus(id, status);
  } catch (err) {
    console.error('[api/admin/orders/:id] failed to save order status:', err);
    return NextResponse.json(
      { ok: false, error: 'Could not save the order status. Please try again.' },
      { status: 500 },
    );
  }
  if (!updated) {
    return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
