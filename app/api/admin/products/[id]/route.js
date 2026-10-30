import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/current-admin';
import {
  buildProduct,
  deleteProduct,
  getProduct,
  readProducts,
  replaceProduct,
  setProductArchived,
} from '@/lib/product-store';

/** Every handler here starts the same way: prove the session before anything else. */
async function requireSession() {
  return Boolean(await currentAdmin());
}

/**
 * PATCH /api/admin/products/:id — edit a product, or restore an archived one.
 *
 * Two shapes, so the table can flip a switch without re-sending the whole form:
 *   { archived: false }   -> restore (or archive) only
 *   { ...full product }   -> replace the editable fields
 *
 * The id in the URL wins. A payload cannot rename or re-point a product, so
 * historical orders keep resolving to the same record.
 *
 * Responses
 *   200 { ok: true, product }
 *   400 invalid JSON body
 *   401 no valid session
 *   404 no product with that id
 *   422 { ok: false, errors: string[] }
 */
export async function PATCH(request, { params }) {
  if (!(await requireSession())) {
    return NextResponse.json({ ok: false, errors: ['Not signed in.'] }, { status: 401 });
  }

  // Next.js 15 hands route params over as a Promise.
  const { id } = await params;


  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['Invalid request body.'] }, { status: 400 });
  }

  const existing = await getProduct(id);
  if (!existing) {
    return NextResponse.json({ ok: false, errors: ['Product not found.'] }, { status: 404 });
  }

  // ---- archive / restore only ----
  const archiveOnly = Object.keys(body ?? {}).length === 1 && 'archived' in (body ?? {});
  if (archiveOnly) {
    const product = await setProductArchived(id, body.archived);
    return NextResponse.json({ ok: true, product });
  }

  // ---- full edit ----
  const products = await readProducts();
  const result = buildProduct(body, { existing, products });
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  try {
    const product = await replaceProduct(id, result.product);
    return NextResponse.json({ ok: true, product });
  } catch (err) {
    console.error('[api/admin/products/:id] failed to update product:', err);
    return NextResponse.json(
      { ok: false, errors: ['Could not save the change. Please try again.'] },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/products/:id — archive the product.
 * DELETE /api/admin/products/:id?permanent=1 — delete it for good.
 *
 * Two steps on purpose, because one of them cannot be undone:
 *
 *   without the flag  archive. The record is kept and hidden from the shop, so a
 *                     mis-click is one click away from being undone. Restore with
 *                     PATCH { archived: false }.
 *   ?permanent=1      really delete, and delete the product's photo files with it.
 *                     ONLY WORKS ON AN ALREADY-ARCHIVED PRODUCT — the store refuses
 *                     a live one, so a stray request cannot destroy something that
 *                     is still on sale. 409 says which case you hit.
 *
 * Past orders survive either way: each order line keeps its own copy of the title
 * and unit price from the moment the order was placed.
 *
 * Responses
 *   200 { ok: true, product }            (product is the record as it was)
 *   401 no valid session
 *   404 no product with that id
 *   409 permanent delete attempted on a product that is still live
 */
export async function DELETE(request, { params }) {
  if (!(await requireSession())) {
    return NextResponse.json({ ok: false, errors: ['Not signed in.'] }, { status: 401 });
  }

  const { id } = await params;


  const permanent = new URL(request.url).searchParams.get('permanent') === '1';

  if (permanent) {
    const result = await deleteProduct(id);
    if (!result.ok) {
      if (result.reason === 'not_archived') {
        return NextResponse.json(
          { ok: false, errors: ['Hide the product first, then delete it.'] },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: false, errors: ['Product not found.'] }, { status: 404 });
    }
    return NextResponse.json({ ok: true, product: result.product });
  }

  const product = await setProductArchived(id, true);
  if (!product) {
    return NextResponse.json({ ok: false, errors: ['Product not found.'] }, { status: 404 });
  }

  return NextResponse.json({ ok: true, product });
}
