'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';


// Imported from order-constants, NOT lib/orders.js: that module pulls in node:fs
// and must never reach the browser bundle.
import { INVOICE_LABELS, INVOICE_STATUSES, ORDER_STATUSES, STATUS_LABELS } from '@/lib/order-constants';
import { matchesOrder } from '@/lib/order-search';
import { formatPrice } from '@/lib/products';
import OrderDocument from '@/components/OrderDocument';

/**
 * OrdersTable — Patricia's order list.
 *
 * A card list on mobile and a table from `lg` up: an order has too many fields
 * to squeeze into a phone-width table without making it unreadable.
 *
 * Each order is a one-line summary until she taps it. Tapping opens a pop-up with
 * the details — contact, items, note, status, collection and the printable order
 * sheet. The pop-up is rendered once for the whole list and reads its order out of
 * `orders`, so a save that refreshes the page updates what she is looking at. No
 * second page and no extra request: opening an order is instant even on a bad
 * connection.

 *
 * Changing a status PATCHes /api/admin/orders/:id and then calls router.refresh()
 * so the server re-renders the page with fresh data. No client-side data cache to
 * fall out of sync.
 */


const STATUS_STYLES = {
  new: 'border-bbRose text-bbRose',
  awaiting_payment: 'border-bbGold text-bbGold',
  paid: 'border-emerald-400/60 text-emerald-300',
  ready: 'border-sky-400/60 text-sky-300',
  completed: 'border-bbInk/30 text-bbInk/60',
  cancelled: 'border-red-500/50 text-red-400',
};

export default function OrdersTable({ orders }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  // Confirmation of the last successful save. Without it a save that worked looks
  // identical to one that did nothing: the fields already hold what you typed.
  const [notice, setNotice] = useState('');
  /** What Patricia typed into the search box. Filtering happens in memory. */
  const [query, setQuery] = useState('');

  // The order Patricia has tapped open. One at a time: a list of fully expanded
  // orders is a wall of text on a phone, and closing the previous one keeps the
  // page short enough to scan.
  const [openId, setOpenId] = useState(null);

  // The one order whose sheet is currently on its way to the printer. Only ever
  // one: the print stylesheet shows every `.bb-doc` on the page, so two would
  // print two sheets.
  const [printOrder, setPrintOrder] = useState(null);

  /**
   * Print the order sheet once React has actually painted it. The sheet lives in
   * a `.bb-print-only` wrapper that is invisible on screen, so there is nothing
   * to see here — the browser's print dialog appears, and "Save as PDF" keeps a
   * copy. The short timeout gives the browser a frame to lay the sheet out;
   * calling window.print() in the same tick can print a blank page.
   */
  useEffect(() => {
    if (!printOrder) return;
    const timer = setTimeout(() => {
      window.print();
      setPrintOrder(null);
    }, 60);
    return () => clearTimeout(timer);
  }, [printOrder]);


  async function changeStatus(id, status) {
    setBusyId(id);
    setError('');
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.status === 401) {
        // Session expired while the tab was open — send them back to log in.
        router.push('/admin/login');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? 'Could not update that order.');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Move the invoice itself. A submitted order is PENDING until this is called
   * with "issued" — that is the action that puts the invoice on her link.
   */
  async function changeInvoice(id, invoice) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice }),
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? 'Could not update the invoice.');
        return;
      }

      router.refresh();
      setNotice(
        invoice === 'issued'
          ? 'Invoice issued. It is visible on her link now.'
          : `Invoice marked ${INVOICE_LABELS[invoice] ?? invoice}.`,
      );
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Save where and when this customer collects. Same endpoint as the status
   * change, different body shape, so the two never overwrite each other.
   */
  async function savePickup(id, pickup) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup }),
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return false;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? `Could not save the collection details (${response.status}).`);
        return false;
      }

      // Pull the page's data again so the list, the pop-up and the invoice all
      // show what was just written.
      router.refresh();
      setNotice(
        pickup.place || pickup.when
          ? 'Saved. Her invoice will carry these details.'
          : 'Saved. The collection details are empty — add them before issuing.',
      );
      return true;
    } catch {
      setError('Network error. Check your connection and try again.');
      return false;
    } finally {
      setBusyId(null);
    }
  }


  /** Whichever order the pop-up is showing, taken fresh from the list. */
  const openOrder = orders.find((order) => order.id === openId) ?? null;

  // Every order is already on the page, so searching is a filter rather than a
  // request: instant on a slow connection, and no round trip to type through.
  const visibleOrders = useMemo(() => orders.filter((order) => matchesOrder(order, query)), [orders, query]);

  if (orders.length === 0) {
    return <p className="bb-prose">No orders yet. They will appear here the moment one comes in.</p>;
  }


  return (
    <>
      {/* Page-level error banner. Only shown when no order is open: with the
          pop-up up, its own copy of this message is the visible one. */}
      {error && !openOrder && (
        <p role="alert" className="mb-6 border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </p>
      )}


      {/* ---------- Search ----------
          Phone numbers match on digits alone, so "+677 741 2345", "741 2345"
          and "7412345" all find the same customer. */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="w-full sm:max-w-sm">
          <span className="bb-label">Search orders</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Phone number or name"
            className="bb-input !py-2.5"
          />
        </label>

        <p className="text-xs text-bbInk/40" aria-live="polite">
          {query ? `${visibleOrders.length} of ${orders.length} orders` : `${orders.length} orders`}
        </p>
      </div>

      {visibleOrders.length === 0 && (
        <p className="bb-prose">
          No orders match &ldquo;{query}&rdquo;. Check the number, or clear the search.
        </p>
      )}

      {/* ---------- Mobile: cards ---------- */}
      <ul className="space-y-4 lg:hidden">
        {visibleOrders.map((order) => (
          <li key={order.id}>
            {/* The whole card is one button: on a phone that is the only
                comfortable tap target. It opens the order in a pop-up. */}
            <button
              type="button"
              onClick={() => setOpenId(order.id)}
              className="bb-card flex w-full items-start justify-between gap-3 p-5 text-left"
            >
              <span className="block">
                <span className="block font-mono text-sm text-bbInk">{order.orderNumber}</span>
                <span className="mt-1 block text-xs text-bbInk/45">{formatDate(order.createdAt)}</span>
                <span className="mt-2 block text-sm font-semibold text-bbInk">{order.customer.name}</span>
                <span className="mt-0.5 block text-xs text-bbInk/45">{itemSummary(order)}</span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge status={order.status} />
                <span className="text-sm font-semibold text-bbRose">{formatPrice(order.total)}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-bbInk/35">Open</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ---------- Desktop: table ---------- */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-bbLine text-[11px] uppercase tracking-[0.18em] text-bbInk/45">
              <th scope="col" className="py-3 pr-4 font-semibold">Order</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Customer</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Items</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">Total</th>
              <th scope="col" className="py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => (
              /* Clicking anywhere on the row opens the pop-up. The order number is
                 also a real button so the row can be reached and opened from the
                 keyboard — a <tr> with an onClick alone cannot be. */
              <tr
                key={order.id}
                onClick={() => setOpenId(order.id)}
                className="cursor-pointer border-b border-bbLine align-top transition hover:bg-bbInk/[0.03]"
              >
                <td className="py-5 pr-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      // Without this the row handler would fire too, opening twice.
                      e.stopPropagation();
                      setOpenId(order.id);
                    }}
                    className="font-mono text-bbInk underline-offset-4 hover:underline"
                  >
                    {order.orderNumber}
                  </button>
                  <p className="mt-1 text-xs text-bbInk/45">{formatDate(order.createdAt)}</p>
                </td>

                <td className="py-5 pr-4">
                  <p className="font-semibold text-bbInk">{order.customer.name}</p>
                  <p className="mt-0.5 text-xs text-bbInk/60">{order.customer.phone}</p>
                  <p className="text-xs text-bbInk/60">{order.customer.location}</p>
                </td>

                <td className="py-5 pr-4 text-xs text-bbInk/60">{itemSummary(order)}</td>

                {/* Every order is collected in person and paid for in cash at that
                    moment, so there is no fulfilment method and no payment method
                    to show, and nothing added on top of the items. */}
                <td className="py-5 pr-4 text-right">
                  <p className="font-semibold text-bbRose">{formatPrice(order.total)}</p>
                </td>

                <td className="py-5">
                  <div className="flex items-center justify-between gap-4">
                    <StatusBadge status={order.status} />
                    <span className="text-[10px] uppercase tracking-[0.14em] text-bbInk/35">Open</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* One pop-up for the whole list, holding whichever order is open. Reading
          the order out of `orders` rather than storing a copy means a status or
          pickup save (which calls router.refresh()) updates what is on screen. */}
      {openOrder && (
        <OrderModal
          order={openOrder}
          busy={busyId === openOrder.id}
          error={error}
          notice={notice}
          onClose={() => {
            setOpenId(null);
            setNotice('');
            setError('');
          }}
          onStatusChange={(status) => changeStatus(openOrder.id, status)}
          onSavePickup={(pickup) => savePickup(openOrder.id, pickup)}
          onSaveInvoice={(invoice) => changeInvoice(openOrder.id, invoice)}
          onPrint={() => setPrintOrder(openOrder)}
        />
      )}


      {/* The order sheet Patricia keeps with the goods. Invisible on screen
          (`bb-print-only`), and the only `.bb-doc` on the page, which is what the
          print stylesheet needs to put one sheet on the paper. The town is passed
          so her sheet carries the same heading as the customer's invoice. */}
      {printOrder && (
        <div className="bb-print-only">
          <OrderDocument
            order={printOrder}
            variant="sheet"
            pickupLocation={process.env.NEXT_PUBLIC_PICKUP_LOCATION || ''}
          />
        </div>
      )}

    </>
  );
}


/**
 * InvoiceEditor — the invoice switch Patricia controls.
 *
 * Separate from the order status on purpose: an order can be paid while the
 * invoice is still unissued, and an invoice can be voided for an order that
 * never happened. The customer only sees the document once this says Issued
 * (or Paid); until then her link says "being prepared".
 */
function InvoiceEditor({ order, disabled, onSave, className = '' }) {
  const current = order.invoiceStatus ?? 'pending';
  const [value, setValue] = useState(current);

  useEffect(() => {
    setValue(current);
  }, [current]);

  const arranged = Boolean(order.pickup?.place || order.pickup?.when);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="bb-label">Her invoice</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-bbInk/45">
          Currently {INVOICE_LABELS[current] ?? current}
        </span>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-bbInk/45">
        A new order is <strong className="text-bbInk/70">Pending</strong> until you issue the
        invoice. While it is pending her link says &ldquo;being prepared&rdquo;.
      </p>

      {!arranged && (
        <p className="mt-2 text-xs leading-relaxed text-bbGold/80">
          No collection place or time yet. The invoice can still be issued, but add them above
          first so the printed copy says where to go.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-[140px] flex-1">
          <span className="sr-only">Invoice status</span>
          <select
            value={value}
            disabled={disabled}
            onChange={(event) => setValue(event.target.value)}
            className="bb-input !py-2 !text-xs disabled:opacity-50"
          >
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INVOICE_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => onSave(value)}
          disabled={disabled || value === current}
          className="bg-bbRose px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-bbBlush disabled:cursor-not-allowed disabled:opacity-40"
        >
          {value === 'issued' && current !== 'issued' ? 'Issue invoice' : 'Save invoice status'}
        </button>
      </div>

      {order.invoiceToken && (
        <a
          href={`/invoice/${order.invoiceToken}`}
          target="_blank"
          rel="noreferrer"
          className="bb-link mt-3 inline-block text-xs"
        >
          Open what she sees
        </a>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
        STATUS_STYLES[status] ?? 'border-bbLine text-bbInk/60'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StatusSelect({ value, onChange, disabled, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="sr-only">Change order status</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="bb-input !py-2 !text-xs disabled:opacity-50"
      >
        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * PickupEditor — where and when this customer collects.
 *
 * ADMIN ONLY. Nothing typed here is shown to the customer automatically: there
 * is no delivery service in the Solomon Islands, so Patricia decides a place and
 * a time, saves it against the order so she does not have to remember it, then
 * messages the customer herself. "Copy message" puts a ready-made sentence on
 * the clipboard for exactly that — paste into WhatsApp, Messenger or SMS.
 */
function PickupEditor({ order, disabled, onSave, className = '' }) {
  const saved = order.pickup ?? { place: '', when: '', note: '' };
  const [place, setPlace] = useState(saved.place);
  const [when, setWhen] = useState(saved.when);
  const [note, setNote] = useState(saved.note);
  const [copied, setCopied] = useState(false);

  // Unsaved-changes hint, so a half-typed pickup is never mistaken for a saved one.
  const dirty = place !== saved.place || when !== saved.when || note !== saved.note;
  const arranged = Boolean(saved.place || saved.when);

  // Adopt whatever the server actually stored. It trims and caps each field, so
  // "Honiara  " comes back as "Honiara" — without this the boxes would keep the
  // untrimmed text, the form would still read as Unsaved, and a save that worked
  // would look like one that failed.
  useEffect(() => {
    setPlace(saved.place);
    setWhen(saved.when);
    setNote(saved.note);
  }, [saved.place, saved.when, saved.note]);

  async function handleSave(event) {
    event.preventDefault();
    await onSave({ place, when, note });
  }


  async function handleCopy() {
    // Her invoice link goes in the message too: it is the only way she can reach
    // her invoice, and it only starts showing one once the details below are saved.
    const invoiceLink = order.invoiceToken
      ? `${typeof window === 'undefined' ? '' : window.location.origin}/invoice/${order.invoiceToken}`
      : '';

    const lines = [
      `Hi ${order.customer.name}, your BOSS BADDIE order ${order.orderNumber} is ready to collect.`,
      saved.place ? `Where: ${saved.place}` : '',
      saved.when ? `When: ${saved.when}` : '',
      saved.note ? saved.note : '',
      `Total to pay: ${formatPrice(order.total)}`,
      invoiceLink ? `Your invoice: ${invoiceLink}` : '',
    ].filter(Boolean);


    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      // Clear the confirmation so the button does not stay stuck on "Copied".
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (older browser, or no https) — not worth an error banner.
      setCopied(false);
    }
  }

  return (
    <form onSubmit={handleSave} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="bb-label !mb-0">Collection details</p>
        {!arranged && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-bbGold">Not arranged yet</span>
        )}
      </div>

      {/* Says out loud what the save button does, so the connection between this
          form and what the customer sees is never a guess. */}
      <p className="mt-1 text-xs leading-relaxed text-bbInk/40">
        {arranged
          ? 'Saved. Her invoice link shows these details.'
          : 'Fill in a place or a time and save — that is what shows the customer her invoice.'}
      </p>


      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">Pickup place</span>
          <input
            type="text"
            value={place}
            maxLength={120}
            disabled={disabled}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="Where — e.g. Honiara Central Market stall"
            className="bb-input !py-2 !text-xs disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="sr-only">Pickup day and time</span>
          <input
            type="text"
            value={when}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="When — e.g. Sat 29 Aug, 9am–12pm"
            className="bb-input !py-2 !text-xs disabled:opacity-50"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Instructions for the customer</span>
        <textarea
          value={note}
          rows={2}
          maxLength={500}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else — landmarks, who to ask for, bring exact change…"
          className="bb-input !py-2 !text-xs disabled:opacity-50"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* The primary action in this whole panel, so it is filled, not outlined:
            saving is what releases the customer's invoice, and the label says so
            the first time round instead of hiding it behind the word "pickup". */}
        <button
          type="submit"
          disabled={disabled || !dirty}
          className="bg-bbRose px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-bbBlush disabled:cursor-not-allowed disabled:opacity-40"
        >
          {disabled ? 'Saving…' : arranged ? 'Save changes' : 'Save collection details'}
        </button>


        <button
          type="button"
          onClick={handleCopy}
          disabled={!arranged}
          className="border border-bbLine px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bbInk/70 transition hover:border-bbInk/40 hover:text-bbInk disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? 'Copied' : 'Copy message'}
        </button>

        {dirty && <span className="text-[11px] text-bbGold">Unsaved</span>}
      </div>
    </form>
  );
}

/**
 * OrderDetails — one order, opened.
 *
 * Everything Patricia needs to act on an order in one place: who to contact,
 * what to pack, what to collect, where to hand it over and the paper copy.
 * Shared by the phone card and the desktop table so the two views can never
 * drift apart.
 */
function OrderDetails({ order, busy, onStatusChange, onSavePickup, onSaveInvoice, onPrint }) {
  return (
    <div className="pt-5">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="bb-label">Customer</p>
          <p className="text-sm font-semibold text-bbInk">{order.customer.name}</p>
          {/* Phone first: this is how she actually reaches people. Most customers
              leave the email blank, so it is only shown when there is one. */}
          <p className="mt-0.5 text-sm text-bbInk/60">{order.customer.phone}</p>
          {order.customer.email && <p className="text-sm text-bbInk/60">{order.customer.email}</p>}
          <p className="text-sm text-bbInk/60">{order.customer.location}</p>
        </div>

        <div>
          <p className="bb-label">Status</p>
          <StatusSelect value={order.status} disabled={busy} onChange={onStatusChange} />
          <p className="mt-2 text-xs leading-relaxed text-bbInk/40">
            This tracks the order itself. Cash is counted as income when you set the
            invoice to Paid below — changing this status does not move the figures.
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-bbLine pt-5">
        <p className="bb-label">Items</p>
        <ul className="space-y-1.5 text-sm text-bbInk/70">
          {order.items.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="flex justify-between gap-4">
              <span>
                {item.qty} &times; {item.title}
                {item.model ? <span className="text-bbInk/40"> — {item.model}</span> : null}
              </span>
              <span className="shrink-0 text-bbInk/45">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-bbLine pt-3">
          <span className="text-xs uppercase tracking-[0.16em] text-bbInk/45">To collect in cash</span>
          <span className="font-semibold text-bbRose">{formatPrice(order.total)}</span>
        </div>
      </div>

      {order.customer.notes && (
        <div className="mt-6 border-t border-bbLine pt-5">
          <p className="bb-label">Her note</p>
          <p className="text-sm italic text-bbInk/55">“{order.customer.notes}”</p>
        </div>
      )}

      <PickupEditor
        order={order}
        disabled={busy}
        onSave={onSavePickup}
        className="mt-6 border-t border-bbLine pt-5"
      />

            {/* The invoice is a separate switch from the order status. Pending until
          Patricia issues it, which is the moment the customer can print it. */}
      <InvoiceEditor
        order={order}
        disabled={busy}
        onSave={onSaveInvoice}
        className="mt-6 border-t border-bbLine pt-5"
      />
      <PrintSheetButton onClick={onPrint} className="mt-4" />

    </div>
  );
}

/** How much is in this order, without listing it: "2 items · 3 pieces". */
function itemSummary(order) {
  const lines = order.items.length;
  const pieces = order.items.reduce((sum, item) => sum + item.qty, 0);
  return `${lines} ${lines === 1 ? 'item' : 'items'} · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}`;
}

/**
 * OrderModal — the order, in a pop-up over the list.
 *
 * Closes on the X, on Escape, and on a click outside the panel — all three,
 * because on a phone the backdrop is the instinctive thing to tap and on a laptop
 * it is Escape.
 *
 * Two details that matter and are easy to miss:
 *   - the page behind is locked from scrolling while it is open, otherwise the
 *     list scrolls under your finger as you scroll the pop-up;
 *   - focus moves into the panel on open, so a keyboard user is not left tabbing
 *     through the list underneath.
 *
 * It is PORTALLED TO document.body on purpose. Rendered in place it sits inside
 * `<main className="relative z-10">` (app/layout.js), and a stacking context caps
 * its children: no z-index on the pop-up could lift it above the sticky site
 * header, which is `z-50` outside that context — the header cut off the top of the
 * panel. As a direct child of <body> it compares against the header directly, so
 * `z-[70]` wins.

 *
 * `bb-no-print` on the whole thing: the printed page is the order sheet, never
 * this screen.
 */
function OrderModal({ order, busy, error, notice, onClose, onStatusChange, onSavePickup, onSaveInvoice, onPrint }) {
  const panel = useRef(null);
  // The latest onClose, without making it an effect dependency. The parent hands
  // down a fresh arrow function on every render, so depending on it directly
  // would tear the effect down and set it up again on every state change —
  // stealing focus back to the panel mid-typing, and worse, re-capturing
  // `previousOverflow` as 'hidden' so the page could never scroll again.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') closeRef.current();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);


  return createPortal(
    <div
      // The backdrop itself never scrolls: it is exactly the viewport, and the
      // scrolling happens inside the panel below.
      className="bb-no-print fixed inset-0 z-[70] flex items-end justify-center overflow-hidden bg-black/80 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        tabIndex={-1}
        // Clicks inside must not reach the backdrop's close handler.
        onClick={(e) => e.stopPropagation()}
        // A column, capped to the viewport: header fixed at the top, body taking
        // the rest and scrolling. `bb-card` is deliberately translucent for the
        // list, so a pop-up has to force an opaque background or the rows behind
        // show through it.
        className="bb-card flex max-h-[92vh] w-full max-w-2xl flex-col !bg-bbCoal outline-none sm:max-h-[86vh]"
      >
        {/* Head stays put while the body scrolls under it: on a long order the
            number and the way out should never scroll off. */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-bbLine p-5">
          <div>
            <p id="order-modal-title" className="font-mono text-sm text-bbInk">
              {order.orderNumber}
            </p>
            <p className="mt-1 text-xs text-bbInk/45">{formatDate(order.createdAt)}</p>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close order"
              className="flex h-9 w-9 items-center justify-center border border-bbLine text-lg leading-none text-bbInk/60 transition hover:border-bbInk/40 hover:text-bbInk"
            >
              &times;
            </button>
          </div>
        </div>

        {/* `overscroll-contain` stops the scroll carrying on into the page behind
            once this reaches the bottom. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
          {/* Result of the last save. It has to live INSIDE the pop-up: a banner
              on the page behind would be hidden by this panel. */}
          {error && (
            <p role="alert" className="mt-5 border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </p>
          )}
          {!error && notice && (
            <p role="status" className="mt-5 border border-emerald-400/40 bg-emerald-400/10 p-3 text-xs text-emerald-200">
              {notice}
            </p>
          )}

          <OrderDetails

            order={order}
            busy={busy}
            onStatusChange={onStatusChange}
            onSavePickup={onSavePickup}
            onSaveInvoice={onSaveInvoice}
            onPrint={onPrint}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}




/**
 * PrintSheetButton — sends this order's sheet to the printer.

 *
 * `bb-no-print` so the button itself never appears on the paper.
 */
function PrintSheetButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bb-no-print border border-bbLine px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-bbInk/70 transition hover:border-bbInk/40 hover:text-bbInk ${className}`}
    >
      Print order sheet
    </button>
  );
}

/** Short, unambiguous date. Fixed locale so server and client agree. */

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
