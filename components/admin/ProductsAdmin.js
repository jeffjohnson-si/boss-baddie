'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, formatPrice } from '@/lib/products';
import { PRODUCT_IMAGE, shrinkImageForUpload } from '@/lib/image-resize';


/**
 * ProductsAdmin — Patricia's catalogue editor.
 *
 * One list of live products, one collapsed list of archived ones, and a single
 * form reused for both adding and editing. Every write goes to
 * /api/admin/products, which re-validates server-side; nothing here is trusted.
 *
 * After each successful write we call router.refresh() so the server re-renders
 * the page. There is no client-side copy of the catalogue to drift out of sync.
 */

const EMPTY_FORM = {
  title: '',
  blurb: '',
  description: '',
  category: 'phone',
  price: '',
  compareAt: '',
  stock: '0',
  featured: false,
  badge: '',
  images: [],
};

/** Matches MAX_IMAGES in lib/product-store.js — the server enforces it too. */
const MAX_IMAGES = 6;

/** Turn a stored product into form state. */
function toForm(product) {
  return {
    title: product.title,
    blurb: product.blurb,
    description: product.description ?? '',
    category: product.category,
    price: String(product.price),
    compareAt: product.compareAt === null || product.compareAt === undefined ? '' : String(product.compareAt),
    stock: String(product.stock),
    featured: Boolean(product.featured),
    badge: product.badge ?? '',
    images: product.images ?? [],
  };
}

export default function ProductsAdmin({ products }) {
  const router = useRouter();

  /** null = form closed, 'new' = adding, otherwise the id being edited. */
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [uploading, setUploading] = useState(false);
  // Which photo is open full size, or null. The thumbnails are 96px on screen but
  // the file behind them is the full upload, so opening one costs no extra bytes —
  // the browser already has it.
  const [preview, setPreview] = useState(null);
  const fileInput = useRef(null);

  /* ---- Escape closes the enlarged photo ---- */
  useEffect(() => {
    if (!preview) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setPreview(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [preview]);


  const live = products.filter((p) => !p.archived);
  const archived = products.filter((p) => p.archived);

  function openNew() {
    setEditing('new');
    setForm(EMPTY_FORM);
    setErrors([]);
  }

  function openEdit(product) {
    setEditing(product.id);
    setForm(toForm(product));
    setErrors([]);
  }

  function close() {
    setEditing(null);
    setErrors([]);
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  /**
   * Delete an archived product for good. There is no undo, so this asks first —
   * and the server refuses outright unless the product is already hidden.
   */
  async function remove(product) {
    const sure = window.confirm(
      `Delete "${product.title}" for good?\n\nThis cannot be undone, and its photos are deleted too. Past orders are not affected.`,
    );
    if (!sure) return;

    setBusyId(product.id);
    setErrors([]);
    try {
      const response = await fetch(`/api/admin/products/${product.id}?permanent=1`, {
        method: 'DELETE',
      });
      if (!(await handleResponse(response))) return;
      router.refresh();
    } catch {
      setErrors(['Network error. Check your connection and try again.']);
    } finally {
      setBusyId(null);
    }
  }

  /** Shared response handling: 401 means the 12-hour session ran out. */
  async function handleResponse(response) {
    if (response.status === 401) {
      router.push('/admin/login');
      return false;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setErrors(data.errors ?? ['Something went wrong. Please try again.']);
      return false;
    }
    return true;
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setErrors([]);

    const isNew = editing === 'new';
    const url = isNew ? '/api/admin/products' : `/api/admin/products/${editing}`;

    try {
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!(await handleResponse(response))) return;

      close();
      router.refresh();
    } catch {
      setErrors(['Network error. Check your connection and try again.']);
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(id, value) {
    setBusyId(id);
    setErrors([]);
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: value ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // DELETE carries no body; the restore case sends the one field it changes.
        body: value ? undefined : JSON.stringify({ archived: false }),
      });
      if (!(await handleResponse(response))) return;
      router.refresh();
    } catch {
      setErrors(['Network error. Check your connection and try again.']);
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Upload one or more photos and append them to the gallery.
   * Uploads run one at a time on purpose: several large files in parallel on an
   * island connection is how you get a stall with nothing to show for it.
   *
   * Each photo is shrunk in the browser before it is sent (lib/image-resize.js),
   * so a 4 MB camera JPEG leaves her phone as a ~100 KB WebP. That saves her
   * upload data as well as every customer's download.
   */
  async function upload(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setErrors([]);

    const added = [];
    const failures = [];

    try {
      for (const file of files) {
        // Returns the original file untouched if the browser cannot re-encode
        // it. Either way the server re-checks the bytes and the size cap.
        const web = await shrinkImageForUpload(file, PRODUCT_IMAGE);

        const body = new FormData();
        body.append('file', web);


        const response = await fetch('/api/admin/uploads', { method: 'POST', body });
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          failures.push(`${file.name}: ${(data.errors ?? ['upload failed'])[0]}`);
          continue;
        }

        const data = await response.json();
        added.push(data.path);
      }

      if (added.length > 0) {
        setForm((f) => ({ ...f, images: [...f.images, ...added].slice(0, MAX_IMAGES) }));
      }
      if (failures.length > 0) setErrors(failures);
    } catch {
      setErrors(['Could not upload. Check your connection and try again.']);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function removeImage(src) {
    setForm((f) => ({ ...f, images: f.images.filter((i) => i !== src) }));
  }

  /** Promote a photo to first: the shop grid and the bag both show images[0]. */
  function makePrimary(src) {
    setForm((f) => ({ ...f, images: [src, ...f.images.filter((i) => i !== src)] }));
  }

  return (
    <>
      {errors.length > 0 && (
        <ul role="alert" className="mb-6 space-y-1 border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {/* ---------- Add / edit form ---------- */}
      {editing === null ? (
        <button type="button" onClick={openNew} className="bb-btn-solid">
          Add a product
        </button>
      ) : (
        <form onSubmit={save} className="bb-card p-5 sm:p-7">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl text-bbInk">
              {editing === 'new' ? 'New product' : 'Edit product'}
            </h2>
            <button type="button" onClick={close} className="bb-link text-sm">
              Cancel
            </button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <input
                type="text"
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                className="bb-input"
              />
            </Field>

            <Field label="One-line blurb" hint="Shown on the product card." className="sm:col-span-2">
              <input
                type="text"
                required
                maxLength={200}
                value={form.blurb}
                onChange={(e) => set('blurb', e.target.value)}
                className="bb-input"
              />
            </Field>

            <Field
              label="Full description"
              hint="Optional — the blurb is reused if you leave this blank."
              className="sm:col-span-2"
            >
              <textarea
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className="bb-input"
              />
            </Field>

            <Field label="Category">
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="bb-input">
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Price (SBD)">
              <input
                type="number"
                required
                min={1}
                step={1}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                className="bb-input"
              />
            </Field>

            <Field label="Was (SBD)" hint="Leave blank for no sale badge.">
              <input
                type="number"
                min={1}
                step={1}
                value={form.compareAt}
                onChange={(e) => set('compareAt', e.target.value)}
                className="bb-input"
              />
            </Field>

            <Field label="Stock" hint="0 shows the product as sold out.">
              <input
                type="number"
                required
                min={0}
                step={1}
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
                className="bb-input"
              />
            </Field>

            <Field label="Badge" hint='Short label, e.g. "New".'>
              <input
                type="text"
                maxLength={40}
                value={form.badge}
                onChange={(e) => set('badge', e.target.value)}
                className="bb-input"
              />
            </Field>

            {/* ---- Photos ---- */}
            <div className="sm:col-span-2">
              <p className="bb-eyebrow">Photos</p>
              <p className="mt-1 text-xs text-bbInk/45">
                Up to {MAX_IMAGES}. PNG, JPEG or WebP, 4 MB each. You can pick several at once. The
                first photo is the one shown in the shop grid and the bag; the rest appear in the
                gallery on the product page. Tap a photo to see it full size. Optional — a product
                with no photo shows a plain BOSS BADDIE tile instead.
              </p>


              {form.images.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-4">
                  {form.images.map((src, index) => (
                    <li key={src} className="w-24">
                      {/* Tapping the photo opens it full size. A button rather than
                          a link so it does not leave the half-filled form behind,
                          and so it works the same on a phone as with a keyboard. */}
                      <button
                        type="button"
                        onClick={() => setPreview({ src, index })}
                        title="Tap to see this photo full size"
                        className={`block border transition-colors ${
                          index === 0 ? 'border-bbRose' : 'border-bbLine hover:border-bbBlush'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Product photo ${index + 1}`}
                          className="h-24 w-24 object-cover"
                        />
                      </button>
                      <p className="mt-1 text-center text-[10px] uppercase tracking-[0.12em] text-bbInk/40">
                        {index === 0 ? 'First' : `#${index + 1}`}
                      </p>
                      <div className="mt-1 flex flex-col items-center gap-1">
                        {index !== 0 && (
                          <button
                            type="button"
                            onClick={() => makePrimary(src)}
                            className="bb-link text-[11px]"
                          >
                            Make first
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(src)}
                          className="text-[11px] text-red-400 underline-offset-4 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  aria-label="Add product photos"
                  accept="image/png,image/jpeg,image/webp"

                  onChange={(e) => upload(e.target.files)}
                  disabled={uploading || form.images.length >= MAX_IMAGES}
                  className="text-sm text-bbInk/70 file:mr-3 file:border file:border-bbLine file:bg-transparent file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.16em] file:text-bbInk disabled:opacity-40"
                />

                {uploading && <span className="text-xs text-bbInk/50">Uploading…</span>}

                {form.images.length >= MAX_IMAGES && (
                  <span className="text-xs text-bbGold">
                    That is {MAX_IMAGES} photos — remove one to add another.
                  </span>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-bbInk/80 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => set('featured', e.target.checked)}
                className="h-4 w-4 accent-bbRose"
              />
              Show this first in the shop
            </label>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="submit" disabled={busy || uploading} className="bb-btn-solid disabled:opacity-50">
              {busy ? 'Saving…' : editing === 'new' ? 'Add product' : 'Save changes'}
            </button>
            <button type="button" onClick={close} className="bb-btn-outline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ---------- Live products ---------- */}
      <h2 className="bb-eyebrow mt-12">In the shop ({live.length})</h2>
      {live.length === 0 ? (
        <p className="bb-prose mt-4">Nothing in the shop right now. Add a product to open it back up.</p>
      ) : (
        <ul className="mt-4 divide-y divide-bbLine border-y border-bbLine">
          {live.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              busy={busyId === product.id}
              onEdit={() => openEdit(product)}
              onArchive={() => setArchived(product.id, true)}
            />
          ))}
        </ul>
      )}

      {/* ---------- Archived ---------- */}
      {archived.length > 0 && (
        <details className="mt-12">
          <summary className="bb-eyebrow cursor-pointer">Hidden from the shop ({archived.length})</summary>
          <p className="mt-2 text-xs text-bbInk/45">
            These are kept so you can put them back. Past orders are unaffected either way — and if
            you are certain you will never sell one again, you can delete it for good from here.
          </p>
          <ul className="mt-4 divide-y divide-bbLine border-y border-bbLine">
            {archived.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                busy={busyId === product.id}
                onEdit={() => openEdit(product)}
                onRestore={() => setArchived(product.id, false)}
                onDelete={() => remove(product)}
              />
            ))}
          </ul>
        </details>
      )}

      {/* ---------- One photo, full size ----------
          Fixed over everything so it works whether the form is open or she is
          scrolled halfway down the list. Tapping the backdrop or pressing Escape
          closes it; nothing about the product changes either way. */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Product photo ${preview.index + 1}`}
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.src}
            alt={`Product photo ${preview.index + 1}`}
            className="max-h-full max-w-full object-contain"
          />

          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Close photo"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center border border-bbLine bg-black/70 text-xl leading-none text-bbInk"
          >
            ×
          </button>

          <p className="absolute bottom-4 left-0 right-0 text-center text-xs uppercase tracking-[0.16em] text-bbInk/50">
            {preview.index === 0 ? 'First photo' : `Photo #${preview.index + 1}`} · tap anywhere to
            close
          </p>
        </div>
      )}
    </>
  );
}

function ProductRow({ product, busy, onEdit, onArchive, onRestore, onDelete }) {
  const soldOut = product.stock <= 0;
  const photos = product.images?.length ?? 0;

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4">
      <div className="min-w-[12rem] flex-1">
        <p className="text-sm font-semibold text-bbInk">
          {product.title}
          {product.featured && <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-bbGold">First</span>}
        </p>
        <p className="mt-0.5 text-xs text-bbInk/45">
          {product.id} · {product.category}
          {photos > 0 ? ` · ${photos} photo${photos === 1 ? '' : 's'}` : ' · no photo yet'}
        </p>
      </div>

      <p className="text-sm text-bbRose">{formatPrice(product.price)}</p>

      <p className={`w-24 text-xs ${soldOut ? 'text-bbGold' : 'text-bbInk/50'}`}>
        {soldOut ? 'Sold out' : `${product.stock} in stock`}
      </p>

      <div className="flex items-center gap-3">
        <button type="button" onClick={onEdit} className="bb-link text-sm">
          Edit
        </button>
        {onArchive && (
          <button
            type="button"
            onClick={onArchive}
            disabled={busy}
            className="text-sm text-red-400 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {busy ? 'Hiding…' : 'Hide'}
          </button>
        )}
        {onRestore && (
          <button type="button" onClick={onRestore} disabled={busy} className="bb-link text-sm disabled:opacity-50">
            {busy ? 'Restoring…' : 'Put back'}
          </button>
        )}
        {/* Only offered on hidden products, and it asks before it goes ahead. */}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="text-sm text-red-400 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Delete for good'}
          </button>
        )}
      </div>
    </li>
  );
}

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="bb-eyebrow">{label}</span>
      {hint && <span className="mt-1 block text-xs text-bbInk/45">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
