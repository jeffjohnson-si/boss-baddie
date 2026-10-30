import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import { buildProduct, insertProduct, readProducts } from '@/lib/product-store';

/**
 * POST /api/admin/products — add a product to the catalogue.
 *
 * Authorisation is checked FIRST, on the server, before the body is read. This
 * endpoint writes what every visitor then sees, so it must never be reachable
 * without a valid session.
 *
 * The id is derived from the title by the store, not accepted from the client, so
 * a request cannot overwrite an existing product by claiming its id.
 *
 * Responses
 *   201 { ok: true, product }
 *   400 invalid JSON body
 *   401 no valid session
 *   422 { ok: false, errors: string[] }  validation failed
 *   500 could not persist
 */
export async function POST(request) {
  if (!(await currentAdmin())) {
    return NextResponse.json({ ok: false, errors: ['Not signed in.'] }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const products = await readProducts();
  const result = buildProduct(payload, { products });
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  try {
    const product = await insertProduct(result.product);
    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (err) {
    console.error('[api/admin/products] failed to save product:', err);
    return NextResponse.json(
      { ok: false, errors: ['Could not save the product. Please try again.'] },
      { status: 500 },
    );
  }
}
