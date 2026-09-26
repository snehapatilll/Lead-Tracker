import { Pool } from 'pg';
import { LEAD_STATUSES } from './domain';

/**
 * Hosted Postgres (Neon, Render) terminates TLS with a certificate chain that
 * is not always present in the container's trust store, so verification is
 * relaxed for remote connections. Local connections use plain TCP.
 * See the "Trade-offs" section of the README.
 */
function sslConfigFor(connectionString: string): false | { rejectUnauthorized: boolean } {
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  return isLocal ? false : { rejectUnauthorized: false };
}

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    ssl: sslConfigFor(connectionString),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Creates the schema if it does not exist.
 *
 * A hand-rolled idempotent bootstrap rather than a migration tool: the schema
 * is a single table and running it on every boot keeps deployment to one step.
 * A real product would use node-pg-migrate or Prisma Migrate instead.
 */
export async function migrate(pool: Pool): Promise<void> {
  const statusList = LEAD_STATUSES.map((s) => `'${s}'`).join(', ');

  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS leads (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      phone      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN (${statusList})),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Supports the default newest-first listing.
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
    -- Supports filtering by status.
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
  `);
}
