import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Write a restorable dump of the production database.
 *
 *   npm run db:backup
 *
 * Uses DATABASE_ADMIN_URL (read access to every table) and pg_dump's custom
 * format. Dumps land in backups/ and the newest `BACKUP_KEEP` files are kept.
 *
 * The dump is only half a backup until a restore has been tried. The README has
 * the restore commands, including the temporary database used to verify this one.
 */

const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP) || 14;

/** Minimal .env reader: KEY=VALUE, optional quotes, no expansion or overrides. */
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/**
 * libpq on Windows does not ship a CA bundle and cannot use the OS trust store,
 * so verify-full fails against Neon even when node-postgres accepts the same URL.
 * The dump is still TLS-encrypted with require; the application remains on
 * verify-full.
 */
function withLibpqSsl(url) {
  return url.replace('sslmode=verify-full', 'sslmode=require');
}

/** Prefer an explicit path, then PATH, then the Windows installer default. */
function findPgDump() {
  const candidates = [
    process.env.PG_DUMP,
    process.env.PG_DUMP_PATH,
    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'pg_dump' || existsSync(candidate)) return candidate;
  }
  return 'pg_dump';
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

async function main() {
  loadEnv(path.join(ROOT, '.env.local'));

  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Set DATABASE_ADMIN_URL or DATABASE_URL before running a backup.');
  }

  await mkdir(BACKUP_DIR, { recursive: true });

  const file = path.join(BACKUP_DIR, `bossbaddie-${timestamp()}.dump`);
  const pgDump = findPgDump();

  const result = spawnSync(
    pgDump,
    [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--file',
      file,
      withLibpqSsl(connectionString),
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );

  if (result.error) {
    if (existsSync(file)) unlinkSync(file);
    throw result.error;
  }
  if (result.status !== 0) {
    if (existsSync(file)) unlinkSync(file);
    throw new Error(`pg_dump exited with status ${result.status}`);
  }

  const size = statSync(file).size;
  if (size === 0) {
    unlinkSync(file);
    throw new Error('pg_dump produced an empty file');
  }
  console.log(`Backup written: ${file} (${(size / 1024).toFixed(1)} KB)`);

  const dumps = readdirSync(BACKUP_DIR)
    .filter((name) => /^bossbaddie-\d{8}-\d{6}\.dump$/.test(name))
    .sort()
    .reverse();

  for (const old of dumps.slice(KEEP)) {
    unlinkSync(path.join(BACKUP_DIR, old));
    console.log(`Pruned old backup: ${old}`);
  }
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exitCode = 1;
});
