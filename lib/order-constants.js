/**
 * Order constants — shared between server and client.
 *
 * WHY THIS FILE EXISTS: lib/orders.js imports the Postgres pool and node:crypto,
 * so it can only ever run on the server. Client components still need the status
 * list and the labels, and importing them from lib/orders.js would drag `pg` and
 * the Node built-ins into the browser bundle and break the build.
 *
 * Keep this file free of any Node import, so both sides can use it safely.
 */

/** The order workflow, in the order Patricia moves through it. */
export const ORDER_STATUSES = [
  'new',
  'awaiting_payment',
  'paid',
  'ready',
  'completed',
  'cancelled',
];

/**
 * How the customer receives the order.
 *
 * BUSINESS RULE: pickup and nothing else. There is no courier or parcel delivery
 * service in the Solomon Islands to hand an order to, so every order is collected
 * in person — which is also why there is no delivery fee and no shipping address
 * anywhere in this codebase. Kept as a list, and validated against, so a request
 * that invents "delivery" is rejected rather than quietly accepted.
 */
export const FULFILMENT_METHODS = ['pickup'];

/**
 * How the customer pays.
 *
 * BUSINESS RULE: one method only — cash, in person, at collection. Card was
 * always absent by design, and bank transfer has been removed too: the order is
 * handed over and paid for in the same moment, so there is no transfer to chase,
 * no receipt to check and no bank details published anywhere on the site.
 *
 * Kept as a list, and validated against, so a request that invents another
 * method is rejected rather than quietly stored.
 */
export const PAYMENT_METHODS = ['cash_on_pickup'];

/**
 * The invoice's own lifecycle, separate from the order's.
 *
 * A submitted order is a request, not a bill, so it starts `pending`: the
 * customer's link says "being prepared" and nothing is owed yet. Patricia issues
 * the invoice when she has reviewed it, marks it paid when the cash is in her
 * hand, or voids it if the order falls through.
 */
export const INVOICE_STATUSES = ['pending', 'issued', 'paid', 'void'];

export const INVOICE_LABELS = {
  pending: 'Pending',
  issued: 'Issued',
  paid: 'Paid',
  void: 'Void',
};

/** Human labels for the statuses above. */
export const STATUS_LABELS = {
  new: 'New',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

