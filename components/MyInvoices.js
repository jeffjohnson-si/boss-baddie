'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkle } from '@/components/Decor';
import { formatPrice } from '@/lib/products';
import {
  INVOICES_STORAGE_KEY,
  forgetInvoice,
  invoiceUrlFor,
  looksLikeOrderNumber,
  parseInvoiceToken,
  readMyInvoices,
  rememberInvoice,
  storageAvailable,
} from '@/lib/my-invoices';

/**
 * MyInvoices — the customer's own invoices, listed on /invoices.
 *
 * WHERE THE DATA COMES FROM: this browser, not the server. A shop customer has
 * no account, so there is no session to ask "which orders are mine?" with. The
 * list is the record of the invoice tokens this device has been handed — added
 * automatically when an order is placed (components/CheckoutClient.js) and by
 * hand when she has a link from somewhere else.
 *
 * That makes the page honest about its limits, which is why it says so on the
 * page: clearing site data or switching phones starts an empty list, and the
 * invoice link itself remains the real key either way.
 *
 * The list is read after mount, never during render, so the server and client
 * markup agree (localStorage does not exist on the server).
 */

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : DATE_FORMAT.format(date);
}

function itemLabel(count) {
  if (!count) return null;
  return `${count} item${count === 1 ? '' : 's'}`;
}

export default function MyInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  // Set only when the browser refuses to store anything: the token is still good,
  // so the page offers the invoice directly instead of pretending to save it.
  const [blockedToken, setBlockedToken] = useState('');

  // ---- Read this device's list once, on mount ----
  useEffect(() => {
    setInvoices(readMyInvoices());
    setHydrated(true);
  }, []);

  // ---- Keep two open tabs in agreement ----
  // The storage event fires in the *other* tabs, which is exactly the case that
  // would otherwise show a list that is silently out of date.
  useEffect(() => {
    function sync(event) {
      if (event.key === INVOICES_STORAGE_KEY) setInvoices(readMyInvoices());
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function handleAdd(event) {
    event.preventDefault();
    setAdded(false);
    setBlockedToken('');

    const token = parseInvoiceToken(link);

    if (!token) {
      setError(
        looksLikeOrderNumber(link)
          ? 'That is your order reference, not your invoice link. Paste the whole link — it ends in a long code.'
          : 'That does not look like an invoice link. Paste the whole link we gave you, or the long code at the end of it.',
      );
      return;
    }

    // Nothing to save it to (private mode, storage blocked). The link she pasted
    // is still the real key, so hand it back to her rather than a fake row.
    if (!storageAvailable()) {
      setError(
        'This browser is not letting the page save anything, so the list cannot be kept here. The link still opens your invoice:',
      );
      setBlockedToken(token);
      return;
    }

    setInvoices(rememberInvoice({ token }));
    setLink('');
    setError('');
    setAdded(true);
  }

  function handleRemove(token) {
    setInvoices(forgetInvoice(token));
    setAdded(false);
  }

  /* ---------------- Loading ---------------- */
  // localStorage cannot be read during the server render, so anything else would
  // either flash "no invoices" at someone who has five, or mismatch on hydration.
  if (!hydrated) {
    return (
      <p className="text-sm text-bbInk/40" aria-live="polite">
        Loading your invoices…
      </p>
    );
  }

  return (
    <div>
      {invoices.length === 0 ? (
        /* ---------------- Empty ---------------- */
        <div className="bb-card p-6 sm:p-8">
          <Sparkle size={20} />
          <h2 className="bb-h3 mt-5">No invoices saved on this device yet.</h2>
          <p className="bb-prose mt-3">
            Send an order and its invoice is added here automatically — right after the
            confirmation screen, before you close the page.
          </p>
          <Link href="/shop" className="bb-btn-solid mt-7">
            Explore Shop
          </Link>
        </div>
      ) : (
        /* ---------------- The list ---------------- */
        <>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="bb-h3">
              {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
            </h2>
            <p className="text-xs text-bbInk/45">Newest first</p>
          </div>

          <ul className="mt-6 divide-y divide-bbLine border-y border-bbLine">
            {invoices.map((invoice) => {
              const date = formatDate(invoice.placedAt ?? invoice.addedAt);
              const meta = [
                invoice.placedAt ? `Ordered ${date}` : date ? `Added ${date}` : null,
                itemLabel(invoice.itemCount),
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <li
                  key={invoice.token}
                  className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-bbInk">
                      {invoice.orderNumber ?? 'Saved invoice link'}
                    </p>
                    {meta && <p className="mt-1 text-xs text-bbInk/45">{meta}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:shrink-0 sm:gap-6">
                    <p className="text-sm font-semibold text-bbRose">
                      {invoice.total ? (
                        formatPrice(invoice.total)
                      ) : (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Amount not saved</span>
                        </>
                      )}
                    </p>

                    <Link
                      href={invoiceUrlFor(invoice.token)}
                      className="bb-btn-outline min-h-[44px] px-5 text-[11px]"
                    >
                      Open Invoice
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleRemove(invoice.token)}
                      className="text-xs text-bbInk/45 underline-offset-4 hover:text-bbRose hover:underline"
                    >
                      Remove
                      <span className="sr-only"> {invoice.orderNumber ?? 'this invoice'} from this list</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ---------------- Add a link by hand ----------------
          The way back for an order placed before this page existed, or on another
          phone. Collapsed so it never competes with the list it duplicates. */}
      <details className="mt-10 border border-bbLine p-5">
        <summary className="cursor-pointer text-sm font-semibold text-bbInk/75">
          Add an invoice from another device
        </summary>

        <form onSubmit={handleAdd} noValidate className="mt-5">
          <label>
            <span className="bb-label">Invoice link or code</span>
            <input
              type="text"
              value={link}
              onChange={(event) => {
                setLink(event.target.value);
                setError('');
                setAdded(false);
                setBlockedToken('');
              }}
              className="bb-input"
              placeholder="Paste the link from your message"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {error && (
            <p role="alert" className="mt-3 text-sm text-bbBlush">
              {error}
            </p>
          )}

          {blockedToken && (
            <Link href={invoiceUrlFor(blockedToken)} className="bb-btn-solid mt-4 w-full sm:w-auto">
              Open This Invoice
            </Link>
          )}

          {added && (
            <p role="status" className="mt-3 text-sm text-bbInk/75">
              Added. It is at the top of your list.
            </p>
          )}

          <button type="submit" className="bb-btn-solid mt-4 w-full sm:w-auto">
            Add Invoice
          </button>
        </form>
      </details>

      {/* ---------------- The limits, said plainly ----------------
          A customer who knows this list is a convenience rather than a backup
          keeps her link, which is the only thing that actually opens the invoice. */}
      <p className="mt-6 text-xs leading-relaxed text-bbInk/45">
        This list is kept in this browser, not in an account — there is nothing to sign in to. It
        follows the phone or computer you ordered on: clearing your site data or switching devices
        starts a new, empty list. Your invoice link is still the key, so keep the copy Patricia
        sends you. Removing an invoice here only tidies this list; it does not cancel the order.
      </p>
    </div>
  );
}
