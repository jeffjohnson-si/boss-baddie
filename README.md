# BOSS BADDIE

Women-empowerment lifestyle and e-commerce site for **BOSS BADDIE**, a Solomon
Islands brand founded and run by Patricia.

Editorial magazine aesthetic on pure black, founder-led storytelling, and a
**manual order flow with no card payment gateway** — customers order online,
collect in person, and pay cash on collection.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then edit the values
npm run dev                    # http://localhost:3000
```

```bash
npm run build && npm start     # production build
```

Node 18.17+ required. Stop the dev server before running `npm run build` — both
write to `.next` and running them together corrupts the output.

---

## The three rules this project is built around

### 1. No online payment — cash on collection only

There is no Stripe, no card form, no wallet, and no `payments` table. There is no
bank transfer either: no account details are published, so there is nothing to
send in advance, no receipt to chase and no reference to match. Checkout collects
contact details, prices the order on the server, and saves it as a **request** for
Patricia to confirm by hand; the money changes hands in cash when the order does.

`PAYMENT_METHODS` in `lib/order-constants.js` has the single value
`cash_on_pickup`, `buildOrder()` sets it rather than asking, and the
`payment_method` enum in `db/schema.sql` has one value so the database cannot
record anything else.

Every surface that mentions money renders `components/PaymentNote.js`, which is
the single source of the wording:

> **Pay cash when you collect**

Change the sentence there and it changes everywhere. Do not add a gateway
without talking to Patricia first — it is a brand decision, not a missing
feature.

### 2. No delivery — every order is collected

There is no courier or postal delivery service in the Solomon Islands to hand an
order to, so a customer orders, Patricia confirms it and tells her where to come,
and the customer collects and pays in person.

That is why there is **no delivery option, no shipping address and no delivery
fee** anywhere: `FULFILMENT_METHODS` in `lib/order-constants.js` has the single
value `pickup`, `buildOrder()` sets it rather than asking, `total` is always
exactly `subtotal`, and the `fulfilment_method` enum in `db/schema.sql` has one
value so the database cannot record a delivery either. A customer outside Honiara
orders as normal and tells us who is collecting for her.

### 3. The image rule

Illustrated character artwork and photography are supplied by Patricia.
**Nothing in this repository draws a woman**, and no cartoon or anime styling is
used anywhere.

- The hero carries no photograph: the brand mark and the headline hold the
  opening screen on their own. The **Our Story** photograph and all five
  **showcase** cards are real images in `public/illustrations/`
  (`our-story-patricia.jpg`, `showcase-bag.jpg`, `showcase-event.jpg`,
  `showcase-tote-bags.jpg`, `showcase-screen-protector.jpg`,
  `showcase-phone-cases.jpg`).
  No placeholder frame is shown anywhere on the site. Any new slot added later
  renders a labelled frame at its final aspect ratio, so nothing shifts when the
  file lands.
- Photography is JPEG; PNG only where transparency is genuinely needed. The two
  supplied PNG photographs were converted to JPEG at the same pixel dimensions
  (3 MB each → ~330 KB) because they carried no alpha channel. The illustrated
  founder artwork (`founder-hero.jpg`) is kept in the folder but is no longer
  referenced by any page.
- Everything else is product mockups, graphic sparkles and abstract shapes,
  all inline SVG in `components/Decor.js` and `components/ProductArt.js`.

#### Dropping in your illustrations

1. Save the file into `public/illustrations/` — JPEG for photography, PNG only
   for artwork with a transparent background, at least 900 px on the long edge.
2. Open `components/IllustrationPlaceholder.js` and set `src` on that slot:

```js
export const ILLUSTRATIONS = {
  story: {
    src: '/illustrations/story-patricia.jpg',   // was null
    width: 900,
    height: 900,
    alt: 'Patricia, founder of BOSS BADDIE',
    // ...
  },
};
```

That is the only edit. While `src` is `null` the component renders a dashed
frame at the final aspect ratio, so swapping in the real artwork causes **no
layout shift**. Keep `width`/`height` matching the real file's pixel dimensions
and keep the `alt` text descriptive — it is what screen readers announce.

---

## Design mockups

`mockups/` holds the three high-fidelity design references as plain
HTML + CSS. Open them straight from disk, no build step:

- `mockups/desktop-homepage.html` — nav, hero lockup, pillars, showcase row, tagline, thin footer
- `mockups/mobile-homepage.html` — hamburger menu, vertical hero stack, single-column pillars
- `mockups/shop-page.html` — sidebar filters, 4-column desktop grid and 2-column mobile grid
- `mockups/mockup.css` — shared palette and type scale

They share the palette and type scale with `tailwind.config.js`, so the mockups
and the live site cannot drift apart silently.

---

## Brand

| Token | Value | Use |
| --- | --- | --- |
| `bbBlack` | `#000000` | page background |
| `bbRose` | `#ff4b8b` | primary accent, solid buttons, links |
| `bbBurgundy` | `#701938` | secondary panels, quote cards |
| `bbBlush` | `#ffc2d4` | eyebrows, soft emphasis |
| `bbInk` | `#f8f8f8` | body text |
| `bbGold` | `#e3b873` | sparkles, crown |

The hot-pink outer frame is a CSS gradient in `app/globals.css` built around
`--bb-frame-pink: #f2447f`; it is not a Tailwind token because nothing but the
`body` background ever uses it.

- **Type** — Georgia (display) and Segoe UI (body), both system fonts. Zero
  webfont downloads by design.
- **Frame** — the site sits inside `.bb-shell`, a rounded near-black panel
  floating on a hot-pink CSS gradient with burgundy floral line-art on the
  margin. Full-bleed below `lg`, because a phone has no screen space to spend
  on a frame. The shell uses `overflow-clip`, not `overflow-hidden` — `hidden`
  would make it a scroll container and break the sticky header.
- **Logo** — `public/logo.png`, rendered only through
  `components/BrandLogo.js`. Used **unchanged**: never recoloured, cropped or
  redrawn. Appears in the header, hero lockup and login screen.
- **`public/logo-mark.png`** — the same artwork, same pixels, with only the flat
  near-black backdrop knocked out to transparency. It exists because the
  supplied `logo.png` has no alpha channel: the opaque version would paint a
  black rectangle wherever the mark sits over the shell. The hero uses it via
  `<BrandLogo transparent />`. `public/logo.png` itself stays exactly as
  supplied.
- **Grain** — an inline SVG `feTurbulence` data URI on `body::after` in
  `app/globals.css`. About 300 bytes, no network request.

---

## Structure

```
app/
  layout.js            cart provider, pink frame, rounded shell, header, footer
  page.js              homepage — hero, four pillars, showcase row, tagline
  shop/page.js         server-side filtering from the URL query string
  shop/[id]/page.js    product page — gallery, full details, add to bag
  shop/invoices/       her own orders and invoices, inside the shop
  checkout/page.js     manual order form
  invoice/[token]/     the customer's own invoice — private link, no login
  invoices/            every invoice this browser has been given — no login either

  our-story/           founder story, uses the "story" photograph slot
  contact/
  account/             her orders, invoices and saved details (phone login)
  account/login/  account/register/  account/profile/
  offline/             what the service worker shows when the network is gone
  admin/               order dashboard (auth-gated)
  admin/products/      catalogue editor (auth-gated)
  admin/login/
  api/account/register/   POST — start a sign-up: text a verification code
  api/account/verify/     POST — check the code, create the account, sign in
  api/account/verify/resend/  POST — another code, same pending sign-up
  api/account/login/request/  POST — text a code to an existing account
  api/account/login/verify/   POST — check the code, issue the session
  api/account/session/    DELETE sign out
  api/account/profile/    PATCH name / location / contact email
  api/orders/          POST — create an order (signed-in customers only)
  api/admin/session/   POST login, DELETE logout
  api/admin/orders/[id]/    PATCH status or pickup details
  api/admin/products/       POST create
  api/admin/products/[id]/  PATCH edit or restore, DELETE archive (?permanent=1 really deletes)
  api/admin/uploads/        POST product photo
components/            UI; components/admin/ is the dashboard
lib/
  products.js          catalogue vocabulary and pure helpers — browser safe
  product-store.js     live catalogue — SERVER ONLY, Postgres
  orders.js            order store — SERVER ONLY, Postgres
  order-constants.js   status list + payment methods — safe for the browser
  my-invoices.js       the browser's own invoice list — safe for the browser
  auth.js              admin session signing and verification
  passwords.js         owner password hashing (scrypt) — SERVER ONLY
  customer-auth.js     shop session token (passwordless) — SERVER ONLY
  customers.js         customer store: register, email lookup, profile — SERVER ONLY
  current-customer.js  "who is signed in to the shop", for pages and routes
  verification.js      sign-up codes: generate, hash, expire, attempt limit
  login-verification.js  login codes: generate, hash, expire, attempt limit
  email.js             the mail transport (console in dev, Brevo in production)
  uploads.js           image upload rules, shared by both upload routes — SERVER ONLY
db/schema.sql          PostgreSQL DDL — the database is the store
mockups/               the three static design mockups
```

The homepage is deliberately a single screen so nothing competes with the hero.

`lib/orders.js` and `lib/product-store.js` both import the Postgres pool, so
client components must take their constants from the browser-safe modules instead:
`ORDER_STATUSES` / `STATUS_LABELS` from **`lib/order-constants.js`**, and
`CATEGORIES` / `formatPrice` from
**`lib/products.js`**. Importing from the store modules pulls `pg` into
the browser bundle and breaks the build.

---

## Products

Patricia edits the catalogue herself at **`/admin/products`** — add, edit, hide,
and delete a hidden one for good. Prices are whole Solomon Islands dollars, and
there are five categories
(`phone`, `beauty`, `journals`, `fitness`, `clothing`).

A product is deliberately plain: title, blurb, description, category, price,
optional "was" price, stock, badge, featured flag and photos. It carries **no
variant list, no device-brand list and no mockup-style field** — Patricia asked
for those to go, because they were three more decisions per item for something a
customer can simply tell her. Anything specific — an exact handset, a name to
print — goes in the description and in the note the customer leaves at checkout.

Where the data lives:

- `lib/products.js` — the vocabulary (categories) and pure helpers. Browser safe.
  `SEED_PRODUCTS` is deliberately **empty**: Patricia's catalogue is her own, and
  shipping invented products would put made-up prices in front of customers. The
  shop shows "being stocked right now" until she adds the first one.
- `lib/product-store.js` — the live catalogue in Postgres (`products`). Server
  only. Edit through `/admin/products`, not by hand.

Two behaviours worth knowing:

- **Stock is held by the order.** A submitted order cannot include a sold-out
  product or request more units than are left, including when the same product
  appears on multiple lines. The units are taken in the same transaction that
  writes the order — `UPDATE products SET stock = stock - $2 WHERE stock >= $2`
  — so two customers cannot both buy the last one: the second gets a `422`
  naming the product. Cancelling the order, or voiding its invoice, puts the
  units back; moving it back into the workflow reserves them again, and fails
  with `409` if they have been sold in the meantime. `orders.stock_released`
  records which side of that line the order is on, so each transition moves
  stock exactly once.
- **Hide first, delete second.** "Hide" sets `archived: true`. The product leaves
  the shop and the bag but the record is kept, so it can be put back. Under
  **Hidden from the shop** each one also offers **Delete for good**, which really
  removes it and deletes its photo files with it. That is the only route to a
  delete: `deleteProduct()` in `lib/product-store.js` refuses a product that is
  still live, and the API answers `409` rather than obliging, so a stray request
  cannot destroy something that is on sale. Orders already placed are untouched by
  any of it, because every order line snapshots its own title and unit price at the
  moment of ordering.
- **Prices are re-read at submit.** `buildOrder()` prices every line from the
  store when the order arrives, so if a price changes while an item sits in
  someone's bag, the order is charged the current price — never the one the
  browser sent.

Photos are optional. Uploading them (PNG / JPEG / WebP, up to 4 MB each, six per
product) fills `images`: `images[0]` is what the shop grid and the bag show, and
the whole list becomes the gallery on the product page. A product with no photo
gets a plain BOSS BADDIE placeholder tile from `components/ProductArt.js` — that
component used to draw a different SVG mockup per product, chosen with an `art`
field, which is gone with the rest. Uploads are validated by
**magic bytes**, not by filename or declared type, stored under a name the server
generates, and SVG is refused outright — an SVG can carry `<script>` and would be
served from our own origin. Locally they land in `public/uploads/` (gitignored);
in production they go to Cloudinary.
Members' profile pictures go through the same checks (2 MB rather than 4) and the
same storage — `lib/uploads.js` holds the rules both routes use.

Clicking anywhere on a shop card opens **`/shop/<id>`**: the gallery, the full
description, and a quantity box. Every card carries
the same pair of buttons — **Order Now** (adds it and goes straight to the order
form) and **Add To Bag** (adds it and leaves her on the grid). Both add straight
from the grid; there is nothing to choose first now that products carry no variant
list. Neither button charges anything: `/checkout` is a form Patricia confirms
by hand. An archived product's page returns 404 rather than staying
reachable by a shared link.

**On a serverless host (Vercel, Netlify) uploads break unless object storage is
configured**: the filesystem is read-only and ephemeral. The catalogue is already
in Postgres. Set `CLOUDINARY_*` to send product photos and avatars to Cloudinary
— the product record only stores a URL, so nothing else has to change.

---

## Accounts

A shop account is an **email address**, and it is **required to order**. That is a
deliberate choice: an order belongs to a person, not to one browser's
`localStorage`, so her orders and invoices follow her to any device.

- `/account/register` — name, email, phone, optional village/suburb. Then a
  **six-digit code by email** (Brevo), which she types back. The account is created
  by that second step and signs her in; there is no password anywhere in the flow.
- `/account/login` — email, then a **six-digit code by email**. There is no password
  to remember. An address with no account is told so plainly, with a pop-up offering
  sign-up (see below).
- `/account` — her orders newest-first, each with its status, its lines, the
  collection details Patricia arranged and a link to the invoice. Four counters on
  top: orders, to pay on collection, paid so far, open.
- `/account/profile` — name and location only. The email address is the login handle
  and the phone is how Patricia reaches her, so both are shown read-only.
- **The shop is members-only.** `/shop` and every `/shop/<id>` page call
  `requireShopper()` (`lib/require-shopper.js`) and redirect to sign in with
  `?next=` pointing at the page she wanted, so she returns to it rather than to
  the homepage.
- On an existing database, apply `db/migrations/011_email_accounts.sql`; a fresh one
  gets the base tables from `db/schema.sql` followed by every migration.

WHY EMAIL: a code by email costs nothing to run on Brevo's free plan, works on any
device, and needs no telecom coverage check. The address is normalised on save
(`normalizeEmail()` in `lib/customers.js`) — trimmed and lowercased, with a unique
index on `lower(email)` — so `Patricia@Example.com` and `patricia@example.com` are
the same account.

The phone number is still collected and still required: Patricia arranges
collection on it and it is snapshotted onto every order. It is **not verified**, and
no longer unique — two people in one household may share a number.

### The code is emailed, and required

Sign-up is two requests. `/api/account/register` validates the form, writes a row
to `signup_verifications` and sends an email. **No customer row exists yet.**
`/api/account/verify` checks the code, creates the customer and signs her in. So an
unverified sign-up cannot log in, cannot order, and does not occupy the address —
and if Brevo refuses the message, the pending row is deleted rather than left as a
half-made account.

Sign-in is the same idea. `/api/account/login/request` emails a code to an existing
account; `/api/account/login/verify` checks it and issues the session.

**An unknown address is refused, not ignored.** The request answers `404` with
`needsAccount: true`, and the sign-in page shows a pop-up naming the address and
offering **Create An Account** (which carries the address into the sign-up form).
That is a deliberate trade against the usual anti-enumeration default: answering
identically for every address meant a new customer was told "a code is on its way"
and then waited forever for an email that was never sent. The cost is that this
endpoint reveals whether an address shops here. The per-address rate limit still
counts every address, and a code is only generated for an account that exists.

The rules apply to both `signup_verifications` and `customer_login_codes`:

- Six digits, generated with `crypto.randomInt` — never `Math.random`.
- Stored as an HMAC of email + code, keyed with `CUSTOMER_SESSION_SECRET`. The
  database never holds a usable code, even if it leaks.
- Ten minutes to live, five attempts, then the row is destroyed.
- Sixty seconds between sends per address. Registration is limited to five per
  address per hour; login-code requests to ten per address per fifteen minutes and
  five per email per hour.

HOW THE EMAIL GOES OUT is `EMAIL_PROVIDER` in `lib/email.js` — the same transport
that sends Patricia's password resets:

```
EMAIL_PROVIDER=console   # development: prints the message to the server log

EMAIL_PROVIDER=brevo     # real mail. Needs BREVO_API_KEY, EMAIL_FROM and
                         # EMAIL_FROM_NAME; the sender must be verified in Brevo.
```

`sendVerificationCode()` in `lib/email.js` owns the wording, so sign-up and sign-in
cannot drift apart. `EMAIL_DEV_SHOW_CODE=1` additionally returns the code in the
API response so a laptop can finish the flow — it must never be set on a deployed
server.

WHAT IS STORED, and where: a `customers` row (name, email, phone, location). No
password, no card, no address, nothing to charge. Every order now
carries `customer_id`; the name, phone and location are still snapshotted on the
order itself, so Patricia's order sheet and the printed invoice read exactly as
they did before accounts existed, and an order survives its account being deleted
(`ON DELETE SET NULL`, never `CASCADE`).

HOW IT IS PROTECTED: a signed httpOnly cookie (`bb_customer_session`, 400 days —
the longest browsers allow) with its own secret, deliberately different from the
admin one. The expiry is slid forward while she uses the app:
`components/SessionKeeper.js` calls `/api/account/session/refresh` at most once a
day and gets a fresh 400-day cookie, so the only thing that signs her out is
logging out. Codes are HMAC-hashed, single-use, expire in ten minutes and allow
five attempts. Login-code requests are limited to ten per address per fifteen
minutes and five per number per hour; registration to five per address per hour.
The account pages and every account route take the customer from the cookie — there
is no id in a URL or a body to tamper with, and `readOrdersForCustomer()` filters
on `customer_id` alone.

## The community (removed for v1)

The site shipped with a members' room — `/community`, a one-off display name and
picture, a polled chat, and moderation under `/admin/community`. **It is not part
of version 1.** All of it was removed: the pages, the API routes, `lib/community.js`,
`lib/current-member.js`, the `components/community/` tree, and the nav entries in
the header, footer and admin bar.

Two things were deliberately left behind:

- The **database tables** (`members`, `community_messages`) and migrations
  `004_community_profile.sql` and `006_community_seed.sql` are still applied, with
  their data. Dropping tables is destructive and can be done later if the room is
  never coming back.
- The `customers.community_name`, `avatar` and `community_profile_set_at` columns
  still exist for the same reason; nothing reads them now.

Reinstating the room means restoring those files from git history and re-adding the
nav entries — the data is still there.


## The owner account

The first account is created once at `/admin/register` while `admin_users` is
empty. After that the page redirects to sign-in, and the API refuses a second
admin.

- `/admin/login` — email and password.
- `/admin/forgot` — emails a one-time reset link to the sign-in address and every
  verified recovery address.
- `/admin/reset?token=...` — sets a new password. The token is single-use, expires
  in 30 minutes, and the password change invalidates every older session.
- `/admin/account` — display name, password change, and up to three recovery
  emails. A recovery address only receives reset links after it is verified.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` are a **local preview login only**: they are
  accepted only when `DEV_LOGIN_ENABLED=1`, and they stop working the moment the
  owner registers. A deployed server never sets that flag, so these values cannot
  sign anyone in — a leaked password is not an admin credential.

Email goes through Brevo (`EMAIL_PROVIDER=brevo`) or the server log in development
(`EMAIL_PROVIDER=console`).

## Orders and the admin dashboard

Patricia signs in at `/admin/login` and
sees every order newest-first, with counters for new, awaiting payment and
completed, plus confirmed revenue. Status moves through:

`new → awaiting_payment → paid → ready → completed` (or `cancelled`)

Each order is a summary line — number, date, name, how many items, total, status.
**Tapping it opens the order in a pop-up**: contact, the item lines, her note, the
status dropdown, the collection fields and **Print order sheet**. It closes on the
X, on Escape, or on a tap outside it, and the list behind is locked from scrolling
while it is open. There is no separate order page and no extra request — the
orders are already on the page, so opening one is instant on a bad connection. On
desktop the whole row is clickable; the order number is also a real button so the
row can be opened from the keyboard.

One pop-up is rendered for the whole list and it reads its order out of `orders`,
so saving a status or the collection details (which calls `router.refresh()`)
updates what she is looking at instead of closing it.


### Telling a customer where to collect

Because there is no delivery, every order carries collection details that only
Patricia can write, under **Collection details** inside an opened order:


- **Where** — the pickup place (max 120 chars)
- **When** — a day and time (max 80)
- **Instructions** — free text: landmarks, who to ask for, bring change (max 500)

They start empty and the order is tagged *Not arranged yet* until she fills them
in. Saving PATCHes `/api/admin/orders/:id` with `{ pickup: { place, when, note } }`
— a separate body shape from `{ status }`, so one action never wipes the other.

Nothing is published to the storefront: **Copy message** puts a ready-made
sentence (order number, where, when, note, total, and her invoice link) on the
clipboard so she can paste it into WhatsApp, Messenger or an SMS herself. That is
deliberate — most customers reach her on Facebook, not by email, and many leave
the email field blank. Stored as `pickup_place` / `pickup_when` / `pickup_note` in
Postgres.

Saving these fields also fills in what the invoice will say; issuing the invoice is a separate step — see below. Inside
an opened order, *Her invoice* says whether the customer can see it yet, with a
link to open exactly what she sees.


### Issuing the invoice

An order and its invoice have separate statuses, because a submitted order is a
request rather than a bill. A new order starts with `invoice_status = pending`.

| Invoice status | What her link shows |
| --- | --- |
| `pending` (default) | "Your invoice is being prepared" |
| `issued` | The printable invoice, with the amount due on collection |
| `paid` | The same invoice, marked paid |
| `void` | "This order was cancelled", and nothing owed |

### Income

The dashboard reports what came in for the **week, month and year**, plus all
time, along with a six-month table and the most recent payments.

INCOME MEANS PAID INVOICES, not the order status. Marking an invoice **Paid** is
what records cash in hand, and `setInvoiceStatus()` stamps `paid_at` the first
time it happens. An invoice that is pending, issued or voided contributes
nothing — a mistaken "paid" that is then voided stops counting.

That date is what the figures are built from: weeks start on Monday, months and
years on the first of the period, all in the database's timezone. A paid order
whose order status is still `new` is income; an order marked `completed` with a
pending invoice is not.

Patricia controls this from **Her invoice** inside an opened order: choose a
status and save, or press **Issue invoice** while it is still pending. Issuing
stamps `invoice_issued_at` the first time only, so the issue date does not move
when the invoice is later marked paid.

Collection details and issuing are independent: she can save where and when to
collect first, then issue, and the printed copy carries them. Issuing with no
place and time is allowed, and the dashboard warns that the printed invoice will
not say where to go.

### Paperwork: the invoice and the order sheet

Every order produces two printable documents, both rendered by the one component
`components/OrderDocument.js` so they can never disagree about what was ordered
or what it costs:

- **Customer invoice** — at `/invoice/<token>`, her own private link. **She does
  not get it at checkout.** Until Patricia has arranged a collection place or
  time, that link says it is being prepared and shows only the order
  number, the lines and the amount to pay. The moment Patricia saves the
  collection details in `/admin`, the same link starts showing the finished
  invoice with a **Print Or Save Invoice** button. Headed *Invoice*, with
  **Amount due on collection** rather than a paid total, because nothing is
  charged online.
- **Patricia's order sheet** — **Print order sheet** on each order in `/admin`.
  Same lines plus the customer's phone, the status and the collection details she
  has arranged, to keep with the goods until they are handed over.

Strictly a *purchase order* is raised by a buyer, so her copy is headed **Order
Sheet**, not Purchase Order.

**How the customer gets her link.** It is shown on the confirmation screen right
after she orders, with a **Copy Link** button and a line telling her to keep it.
It also appears in her account (`/account`) on any device she signs in from, in
the device-only list at `/invoices`, and in the text that **Copy message** puts on
Patricia's clipboard. No email required at any point.

**How the link is protected.** The token *is* the authorisation: 24 random bytes
(`invoiceToken`, base64url), generated per order in `lib/orders.js`.
`readOrderByInvoiceToken()` matches on that field only — never on the order
number, which is short, printed on paper and trivially guessable. An unknown token
gets the ordinary 404, so nothing confirms which links exist, and the page is
`robots: noindex`. Accounts now let her see her own orders at `/account`, but the
token still has to work on its own: a link Patricia pastes into WhatsApp has to
open for a customer who has not signed in.

### Invoices, in the shop

**`/shop/invoices` is the real list.** It sits beside the products as the second
tab of the shop, and its content is one row per order from Postgres — status,
lines, collection details and the link to the printable invoice. On any phone she
signs in from. `/account` shows the same query but only the last three, with the
counters above it.

The older `/invoices` page is kept for the two cases an account cannot cover — a
link handed out before accounts existed, and a customer who has not signed up yet.

It shows every invoice **that browser** has been handed: order number, date,
amount and a link to each one. A row is added the moment an order is placed
(`rememberInvoice()` in `components/CheckoutClient.js`), and the page accepts a
pasted link, which covers an order placed before accounts, on another phone, or
straight from Patricia's message.

The list lives in `localStorage` under `bb_invoices_v1` (`lib/my-invoices.js`), the
same trade the bag makes, and a row holds only the token, order number, amount and
dates: no name, phone or email. It is not a second source of truth and must not
become one — the order itself is only ever read through the token or the account.
The consequences are stated on the page:

- It does not follow her to another device, and clearing site data empties it.
  `/account` does follow her, which is why accounts are now required to order.
- **Remove** only tidies the list. It cancels nothing and does not touch the order.
- Nothing is indexed: the route is `noindex` and renders an empty list to a crawler.

Two deliberate omissions:

- **No PDF library.** `window.print()` gives the browser's own dialog, and *Save
  as PDF* in that dialog produces the file. A PDF generator would be a large
  download for a document the browser already makes.
- **No tax line and no registration number.** The price shown is the price paid.
  Add one only if Patricia registers for GST.

How the printing works, in `app/globals.css`: `@media print` hides everything
with `visibility: hidden` and then re-shows the `.bb-doc` subtree, which is why
it uses `visibility` and not `display` — a `display: none` ancestor cannot be
un-hidden by a child. `.bb-no-print` drops buttons and helper text from the
paper, and `.bb-print-only` lets `/admin` hold the order sheet in the page
without it showing on screen. **Only one `.bb-doc` may exist while printing**, so
`OrdersTable` keeps a single `printOrder` in state and renders exactly one sheet.


### Database

Everything except uploaded images lives in PostgreSQL:

| table | holds |
| --- | --- |
| `products` | Patricia's catalogue |
| `orders`, `order_items` | every order and its lines |
| `customers` | shop accounts |
| `signup_verifications` | pending phone sign-ups |
| `customer_login_codes` | passwordless sign-in codes |
| `admin_users` | the owner account and hashed password |
| `admin_recovery_emails` | verified addresses that may receive reset links |
| `admin_password_resets` | single-use reset-link hashes |
| `schema_migrations` | which SQL files have been applied |
| `members`, `community_messages` | unused since v1; the members' room was removed |

Uploaded photos go to `public/uploads/` locally and to Cloudinary in production.

**Connections.** `DATABASE_URL` is the DML-only `bossbaddie_app` role the site
uses. `DATABASE_ADMIN_URL` is the owner role, used only by `npm run db:migrate`.

**Migrations.** `npm run db:migrate` applies `db/schema.sql` and every pending
file in `db/migrations/`, recording each one in `schema_migrations`. Running it
twice is safe.

**Backups.** `npm run db:backup` writes a custom-format `pg_dump` to `backups/`
and keeps the newest 14. A backup is not real until a restore has been tried:

```bash
pg_restore --no-owner --no-privileges -d "$RESTORE_DATABASE_URL" backups/bossbaddie-*.dump
```

On the production server, schedule `npm run db:backup` with cron or a systemd
timer and copy the dumps off the machine. The job needs `pg_dump` (PostgreSQL 18
client) and the project's `.env.local`. For example:

```cron
0 2 * * * cd /srv/boss-baddie && /usr/bin/npm run db:backup >> /var/log/boss-baddie-backup.log 2>&1
```

Neon's free plan includes a short restore window and one manual snapshot, but that
is not a substitute for your own copy.

**Uploads are the remaining disk dependency.** The database can be replaced
without losing orders, customers or chat history; `public/uploads` cannot.

Schema notes worth knowing before you touch it:

- Money is `NUMERIC(10,2)`, never a float.
- **Every primary key is `TEXT`, not `UUID`.** The app generates prefixed ids
  (`ord_<uuid>`, `mem_<uuid>`, `msg_<uuid>`), so a `UUID` column would reject
  every row it writes.
- `order_status`, `fulfilment_method` and `payment_method` are Postgres enums
  mirroring `lib/order-constants.js`. `fulfilment_method` and `payment_method`
  have exactly one value each, `pickup` and `cash_on_pickup` — the database is
  deliberately unable to record a card payment, a bank transfer, or a delivery
  that nobody can actually make.
- `order_items.product_id` is **not** a foreign key. An order line must survive
  a product being deleted from the catalogue.
- Lines snapshot `title` and `unit_price`, so editing a price later never
  rewrites the history of a placed order.
- `CHECK` constraints enforce `total = subtotal` (there is no fee to add) and
  `qty BETWEEN 1 AND 25`.

---

## Deployment

### A single VPS with a persistent disk (alternative)

**Uploads need Cloudinary on a serverless host.** Orders, customers, products
and the chat live in managed PostgreSQL. Product photos and avatars go to
`public/uploads` locally, but a serverless deploy must set `CLOUDINARY_*` to a
free Cloudinary account. A VPS with a persistent disk is the alternative if you
would rather keep uploads on disk.

For the Solomon Islands, put the server in **Sydney**: Honiara's internet lands
there directly over the Coral Sea Cable System, so any other region adds a leg.

```bash
git clone <repo> && cd boss-baddie
npm ci && npm run build
# keep it alive
npx pm2 start npm --name boss-baddie -- start
```

Then:

1. Put Nginx in front, proxying to `127.0.0.1:3000`, and terminate TLS there with
   certbot. **TLS is not optional** — both session cookies are `secure` in
   production, so over plain HTTP nobody can log in at all: the browser accepts
   the login response and discards the cookie.
2. Firewall everything except 22, 80 and 443. Port 3000 must not be reachable
   from outside; the rate limiter in `lib/rate-limit.js` trusts a forwarded-IP
   header, which is only trustworthy if the proxy is the sole way in.
3. Set every variable from `.env.example`, including both database URLs.
   Generate the session secrets with:
   ```bash
   openssl rand -base64 32
   ```
   They must differ from each other and from the placeholders.
4. Run `npm run db:migrate`, then schedule `npm run db:backup` and a copy of the
   Cloudinary assets (or `public/uploads` on a VPS). Test a restore once.

`@next/swc-win32-x64-msvc` is in `optionalDependencies` precisely so a Linux
build does not fail on it.

### Netlify (free plan)

Netlify's Free plan allows commercial use. Two limits matter:

- **300 usage credits/month**, shared by bandwidth, deploys and function compute.
- **Functions run in Ohio (US East)** on Free; changing the region requires a paid
  plan. Neon should therefore live in US East, or every dynamic page pays an
  Ohio ↔ Sydney round trip.

Deploy from a Git repository or with `npx netlify-cli deploy --prod`. Set every
variable from `.env.example`, with these production differences:

- `DATABASE_URL` — the Neon app role (pooled, `sslmode=verify-full`).
- `DATABASE_ADMIN_URL` — **not** set on Netlify; migrations run from a workstation.
- `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `EMAIL_FROM` (verified in Brevo).
- `CLOUDINARY_*` — required; the free plan needs no card. The Netlify filesystem
  is ephemeral.
- `NEXT_PUBLIC_SITE_URL` — the real site URL, so reset links work.
- Do **not** set `DEV_LOGIN_ENABLED` or `EMAIL_DEV_SHOW_CODE`.

Never leave `EMAIL_PROVIDER=console` on the deployed site: reset links would be
written to the server log instead of delivered.

After the first deploy, open `/admin/register` once to create Patricia's owner
account. That page needs no credentials — it is open only while `admin_users` is
empty. Never put `ADMIN_EMAIL` / `ADMIN_PASSWORD` in the Netlify environment: they
are a local preview login and are refused on any server without
`DEV_LOGIN_ENABLED=1`.

### Vercel and other serverless hosts

Set `CLOUDINARY_*` before deploying. The database is already managed Postgres, so
serverless functions can reach it; Cloudinary is what keeps Patricia's photos
alive across deploys.

### Post-deploy checklist

- [ ] Homepage, `/shop`, `/our-story`, `/contact` all load
- [ ] The owner account is created at `/admin/register`, and the old
      `ADMIN_EMAIL` / `ADMIN_PASSWORD` pair no longer signs in
- [ ] `/admin/forgot` delivers a Brevo email, and the link sets a new password once
- [ ] A recovery email receives its confirmation, then a reset link
- [ ] Changing the password signs out a second browser using the old session
- [ ] Sign-up emails a code, and no account exists until the right code is entered
- [ ] A wrong code is refused, and the fifth wrong code ends that sign-up
- [ ] Logging out, then signing in with email + a new emailed code works
- [ ] An unknown email address gets the generic response and no code
- [ ] `EMAIL_PROVIDER=console` prints the message in the server log; Brevo delivers
      it to a real inbox
- [ ] `/checkout` sends a signed-out visitor to sign in, then back to checkout
- [ ] A new account sees its own order at `/shop/invoices`, and no one else's
- [ ] Signed out, `/shop` and a product link both land on sign-in and then back
      on the page that was asked for
- [ ] The My Invoices tab is highlighted on `/shop/invoices`, and Shop is not
- [ ] Signing in on a second browser shows the same orders and invoices
- [ ] `/account/profile` saves details; there is no password field
- [ ] The site installs from a phone home screen and opens without browser chrome
- [ ] With the network off, a page falls back to `/offline`, and `/account` is never
      served from the cache
- [ ] `/shop?category=phone` filters, and the filtered URL is shareable
- [ ] Clicking a shop card opens `/shop/<id>` with its photos and details
- [ ] Add to bag survives a page reload (`localStorage`)
- [ ] A test order appears in `/admin` with the correct total
- [ ] `/admin` redirects to `/admin/login` when signed out
- [ ] Changing a status persists across a refresh
- [ ] Tapping an order in `/admin` opens the pop-up, and the X, Escape and a tap
      outside all close it

- [ ] Saving Collection details on an order persists across a refresh, and
      "Copy message" puts the where/when on the clipboard

- [ ] The payment note is visible on shop and checkout, and says cash on collection
- [ ] After ordering, the confirmation screen shows the invoice link and Copy Link works
- [ ] That order appears at /invoices on the same device, and Open Invoice reaches it
- [ ] "Add an invoice from another device" accepts a pasted link; Remove only drops
      the row, and leaves the order alone
- [ ] That link says "being prepared" while the invoice is still pending
- [ ] Pressing Issue invoice in /admin turns the same link into the printable invoice
- [ ] Void shows "This order was cancelled" and no amount on that link
- [ ] Marking an invoice Paid moves the week/month/year income figures, and
      voiding it moves them back
- [ ] Saving a place or time in `/admin` turns the same link into the invoice, and
      "Print Or Save Invoice" opens the print dialog
- [ ] The printed invoice is the only thing on the page — no header, no buttons
- [ ] A made-up `/invoice/<token>` returns 404
- [ ] "Print order sheet" in `/admin` prints one sheet, for the right order


- [ ] `NEXT_PUBLIC_PICKUP_LOCATION` and `NEXT_PUBLIC_WHATSAPP` are Patricia's real details
- [ ] Illustrations uploaded, or the placeholders are intentionally still there

---

## Built for slow connections

Pacific bandwidth was a design constraint, not an afterthought:

- **No webfonts.** System fonts only — nothing to download before text paints.
- **No carousel.** The product row is a grid; all of it is visible with zero
  interaction JavaScript.
- **SVG instead of photography** for decoration and product mockups: roughly 1 KB
  each against 150–300 KB for a JPEG.
- **AVIF/WebP** with a narrow `deviceSizes` list in `next.config.mjs`, so a phone
  never downloads a desktop-sized image.
- **Server-rendered filtering.** A filtered shop page is plain cacheable HTML,
  not a client-side fetch.
- **Grain via a data URI**, so the texture costs no request.
- Server components by default; only the cart, filters, product cards, checkout
  form and admin table ship JavaScript.

Homepage first load is around 108 KB of JS including the shared runtime.

Decorative sparkle positions are hard-coded, never `Math.random()` — random
values would differ between the server and client render and cause a hydration
mismatch.

---

## The app (installable PWA)

The site can be installed to a home screen and opened without browser chrome:

- `public/manifest.webmanifest` — name, colours, standalone display, shortcuts to
  Shop and My Orders. Icons in `public/icons/` are generated from the supplied
  `logo.png` on the brand black, including a maskable one kept inside the 80% safe
  zone so Android does not crop the wordmark.
- `public/sw.js` — a deliberately small service worker. Navigations are network
  first with one cached copy and `/offline` as the fallback; `/_next/static/*`,
  icons and the logo are cache-first because their filenames are hashed; API calls
  are never cached. **Private pages (`/account`, `/checkout`, `/invoice`,
  `/invoices`, `/admin`) are never written to a cache** — a cached copy would be
  readable after sign-out on a shared phone.
- `components/ServiceWorkerRegister.js` registers it in production only; a worker
  in `next dev` caches the dev server's own output and sends you hunting ghosts.
- `components/InstallBanner.js` is the FIRST-VISIT invitation: a small card, a few
  seconds after any page loads, with a real install button where the browser fires
  `beforeinstallprompt` and the Share -> Add to Home Screen instruction on iPhone.
  Dismissing it stores a flag and it never returns on that device; it is not shown
  at all when the app is already running standalone.
- `components/InstallPrompt.js` is the quieter version of the same offer, on the
  account page, for someone who dismissed the card and changed her mind.
- `components/BottomNav.js` — the app-style tab bar on phones (Home, Shop, Orders,
  Account). Desktop keeps the editorial top nav.

Installability needs **HTTPS** (or localhost). There is no build step for any of
it: the manifest, the worker and the icons are plain files in `public/`.

## Security hardening

The owner login is a real database account now: scrypt password hash, one-time
reset links, and recovery addresses that must be verified before they receive
mail. The environment pair remains only as a first-run bootstrap. Read this before
the site holds real customer data.

Already in place:

- Session cookie is httpOnly, `sameSite=lax`, `secure` in production, signed
  with HMAC-SHA256 and expires after 12 hours.
- Credential comparison hashes both sides to a fixed length, then uses
  `crypto.timingSafeEqual`.
- **Basic rate limiting** (`lib/rate-limit.js`), counted per address in memory:
  ten wrong admin logins per fifteen minutes, fifteen wrong member sign-ins per
  fifteen minutes, five sign-ups per hour, ten order submissions per fifteen
  minutes, and ten password-change attempts per member per fifteen minutes. A
  correct sign-in clears the count, so a fumbled password cannot lock Patricia
  out of her own dashboard. Read the limits as defence in depth, not the defence
  — the counts are forgotten on restart, are per process, and trust a
  forwarded-IP header, which is only trustworthy when a proxy is the sole route
  in.
- Sign-up refuses **before texting a code** if `CUSTOMER_SESSION_SECRET` is
  missing, so nobody is sent a code for a session that could never be issued.
- Postgres enforces the relationships and the `orders_total_matches` /
  `order_items_line_total_matches` checks, so an interrupted request cannot leave
  a half-written order or a line whose arithmetic disagrees with its total.
- Admin passwords are hashed with scrypt and a random 16-byte salt. The
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` pair is honoured only when
  `DEV_LOGIN_ENABLED=1`, so it is a local preview login rather than a deployed
  credential.
- Reset and recovery-verification tokens are stored only as SHA-256 hashes,
  single-use, and expire (30 minutes for resets, 24 hours for recovery).
- The admin session carries the account id and a `session_version`. A password
  change or reset increments the version, invalidating every older cookie.
- Customer sessions also carry a `session_version`, ready for a future revocation
  step. Today, deleting the customer row blocks her at the next request.
- Sign-up and login codes are HMAC-hashed, single-use, expire in ten minutes and
  allow five attempts.
- `/admin` checks the session in a server component and `redirect()`s before it
  reads any order data — nothing leaks into the HTML.
- Order prices are **always** re-read from the catalogue server-side; whatever
  the browser claims a price is gets discarded. Quantities are clamped to 1–25.
- Admin pages set `robots: { index: false }`.

Not yet, and worth doing before scale:

- **Backups.** `npm run db:backup` dumps the database, but nothing schedules it or
  copies the dumps off this machine yet. Cloudinary assets also need a periodic
  export or a local copy of the originals. Wire both to an off-machine routine
  before launch; this is the biggest remaining gap for a non-technical owner.
- **A proxy in front.** Cloudflare or Nginx, for TLS, for real rate limiting that
  survives a restart, and so the forwarded-IP header the limiter reads can be
  trusted.
- **Missing configuration fails late and quietly.** A missing
  `ADMIN_SESSION_SECRET` does not throw at boot or at build — `getSecret()` is
  only reached at request time and every caller catches it. The visible effect is
  that admin login always answers "those details do not match", which looks like
  a wrong password rather than a broken server. A boot-time check would be worth
  adding.
- **Production email.** Passwordless sign-in needs Brevo configured and its sender
  verified. `console` only prints codes to the server log and is development-only.
- **Per-user accounts and an audit trail** once more than one person has access.
- **CSRF tokens** on the admin mutation routes. Same-site cookies cover the common
  case, not every case.
- **Session revocation.** A customer row is re-read on every request, so deleting
  it blocks her immediately. Rotating `CUSTOMER_SESSION_SECRET` signs every account
  out at once.

Rotate `ADMIN_SESSION_SECRET` to invalidate every admin session, and
`CUSTOMER_SESSION_SECRET` to sign every customer out.

---

## Licence and assets

The logo and brand marks belong to Patricia / BOSS BADDIE and are not covered by
any open-source licence. Uploaded illustrations remain hers.
