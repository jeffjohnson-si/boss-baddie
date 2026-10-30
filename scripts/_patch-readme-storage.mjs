import fs from 'node:fs';

const path = 'README.md';
let text = fs.readFileSync(path, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const L = (...lines) => lines.join(eol);

let failures = 0;
function replaceOnce(label, oldS, newS) {
  const count = text.split(oldS).length - 1;
  if (count !== 1) {
    console.error(`FAIL ${label}: found ${count}`);
    failures += 1;
    return;
  }
  text = text.replace(oldS, () => newS);
}

// Replace the whole storage + "moving to Postgres" region.
const start = text.indexOf('### Storage');
const end = text.indexOf('Schema notes worth knowing before you touch it');
if (start === -1 || end === -1) {
  console.error('FAIL storage bounds');
  failures += 1;
} else {
  const block = L(
    '### Storage',
    '',
    '**PostgreSQL holds the shop:** `customers`, `orders`, `order_items`, `products`,',
    '`signup_verifications`, plus the invoice and income columns added by migrations',
    '001-005. `DATABASE_URL` is the only setting it needs.',
    '',
    '**One JSON file remains** — the chat — alongside uploaded images:',
    '',
    '| file | written by | holds |',
    '| --- | --- | --- |',
    '| `community.json` | `lib/community.js` | the chat room (`community_messages` is the migration target) |',
    '| `public/uploads/` | `lib/uploads.js` | product photos and community pictures |',
    '',
    'The chat store writes atomically (`.tmp` then rename), so an interrupted write',
    'cannot truncate the room.',
    '',
    '**There is still no backup.** Nothing in this repo copies the database or',
    '`public/uploads` anywhere. Set that up as part of deployment; it is the largest',
    'remaining gap for a non-technical owner.',
    '',
    '**On a serverless host the chat and the uploads break** — read-only, ephemeral',
    'filesystem. Deploy to a VPS with a persistent disk until both are moved.',
    '',
    '### Moving the chat to Postgres',
    '',
    '```bash',
    'psql "$DATABASE_URL" -f db/schema.sql',
    '```',
    '',
    'Orders, products, customers and sign-up verification are already there. The only',
    'remaining `TODO(postgres)` markers are in `lib/community.js`, and the SQL for each',
    'is written in `db/schema.sql`. Nothing switches this with an environment variable —',
    'implementing the markers is the work.',
    '',
    'Uploaded photos still live in `public/uploads`, so a persistent disk is still',
    'needed; object storage is a separate job.',
    '',
  );
  text = text.slice(0, start) + block + text.slice(end);
}

// Two schema bullets that still describe the retired member table.
replaceOnce(
  'primary key note',
  '(`ord_<uuid>`, `mem_<uuid>`, `msg_<uuid>`), so a `UUID` column would reject',
  '(`ord_<uuid>`, `cus_<uuid>`, `msg_<uuid>`), so a `UUID` column would reject',
);

replaceOnce(
  'author id note',
  L(
    '- `community_messages.author_id` is `TEXT` with **no foreign key** to `members`.',
    "  Patricia's own messages carry `author_id = 'owner'` and she has no member row —",
    '  she never signed up — so a foreign key would reject every message the founder',
  ),
  L(
    '- `community_messages.author_id` is `TEXT` with **no foreign key** to `customers`.',
    "  Patricia's own messages carry `author_id = 'owner'` and she has no customer row —",
    '  she never signed up — so a foreign key would reject every message the founder',
  ),
);

if (failures) {
  console.error('README not written.');
  process.exit(1);
}
fs.writeFileSync(path, text, 'utf8');
console.log('README patched');
