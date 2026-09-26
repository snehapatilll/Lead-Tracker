import { Pool } from 'pg';
import { LEAD_STATUSES } from './domain';

/**
 * TLS policy for the database connection.
 *
 * Remote connections verify the server's certificate chain in full. Encrypting
 * without verifying still leaves a man-in-the-middle window, so this is the
 * default - and it was confirmed working against the deployment's actual
 * provider rather than assumed.
 *
 * Some providers terminate TLS with a self-signed or private chain absent from
 * the container's trust store. `DATABASE_SSL_NO_VERIFY=true` is the escape
 * hatch for those. It is deliberately opt-in, so weakening verification is
 * always a visible decision rather than a silent default.
 *
 * Local connections use plain TCP.
 */
function sslConfigFor(connectionString: string): false | { rejectUnauthorized: boolean } {
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
  if (isLocal) return false;

  return { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== 'true' };
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
