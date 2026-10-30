import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

/**
 * Apply the database schema and every pending migration.
 *
 *   npm run db:migrate
 *
 * Uses DATABASE_ADMIN_URL (DDL rights), falling back to DATABASE_URL so a single
 * connection string still works in development. The application itself connects
 * with the DML-only role in DATABASE_URL and never runs this file.
 *
 * Every applied file is recorded in `schema_migrations`, so running it twice is
 * safe and a fresh database gets `db/schema.sql` followed by each migration in
 * filename order. The SQL files manage their own transactions.
 */

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env.local');

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

async function main() {
  loadEnv(ENV_FILE);

  const connectionString = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Set DATABASE_ADMIN_URL or DATABASE_URL before running migrations.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));

    async function apply(name, file) {
      if (applied.has(name)) {
        console.log(`skip  ${name}`);
        return;
      }

      const sql = await readFile(file, 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
        [name],
      );
      applied.add(name);
      console.log(`apply ${name}`);
    }

    // The base schema is idempotent, so it is safe on an existing database too.
    await apply('schema.sql', path.join(ROOT, 'db', 'schema.sql'));

    const migrationsDir = path.join(ROOT, 'db', 'migrations');
    const migrations = (await readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const name of migrations) {
      await apply(name, path.join(migrationsDir, name));
    }

    console.log(`\nDatabase is up to date (${applied.size} files applied).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
