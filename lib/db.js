import { Pool } from 'pg';

const globalForPg = globalThis;

/**
 * One pool for the whole process.
 *
 * CONNECTION IS CONFIGURATION, NOT CODE: DATABASE_URL is read here, and no
 * credentials live in the repository. Without it, `pg` falls back to its own
 * PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE variables, which is how a
 * local cluster is normally run.
 *
 * Cached on globalThis outside production so Next's dev reloads reuse one pool
 * instead of opening a new set of connections on every edit. The cache is keyed
 * by the connection string: editing DATABASE_URL reloads this module but
 * globalThis survives, and without the key the process would silently keep
 * querying the old database until it was restarted.
 */
const connectionString = process.env.DATABASE_URL;
const cacheKey = connectionString ?? 'default';

const cached = globalForPg.pgPoolCache;

/**
 * Serverless functions get one small pool per instance. A default pool of ten
 * would multiply across instances and exhaust Neon's connections, so cap it.
 * allowExitOnIdle lets an idle function instance shut down cleanly.
 */
const poolOptions = connectionString
  ? {
      connectionString,
      max: process.env.NETLIFY || process.env.VERCEL ? 2 : 10,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    }
  : { max: 2, idleTimeoutMillis: 10_000, allowExitOnIdle: true };

export const pool =
  cached?.key === cacheKey ? cached.pool : new Pool(poolOptions);

// Cache in every environment: a dev reload reuses the pool, and a warm
// serverless instance reuses it for the next request.
if (cached && cached.key !== cacheKey) {
  // The old database is no longer configured; let its connections drain.
  cached.pool.end().catch(() => {});
}
globalForPg.pgPoolCache = { key: cacheKey, pool };