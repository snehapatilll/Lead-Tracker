import './env';
import type { Pool } from 'pg';
import { createApp } from './app';
import { createPool, migrate } from './db';
import type { LeadRepository } from './repositories/leadRepository';
import { InMemoryLeadRepository } from './repositories/inMemoryLeadRepository';
import { PostgresLeadRepository } from './repositories/postgresLeadRepository';

/**
 * Resolves the storage backend.
 *
 * `USE_IN_MEMORY_DB=true` runs the whole app against the in-memory repository
 * so it can be demoed or reviewed without provisioning Postgres. Data is lost
 * on restart, so it is refused in production to avoid silently shipping a
 * deployment that drops every lead on redeploy.
 */
async function resolveRepository(): Promise<{ repo: LeadRepository; pool?: Pool }> {
  const isProduction = process.env.NODE_ENV === 'production';
  const wantsInMemory = process.env.USE_IN_MEMORY_DB === 'true';

  if (wantsInMemory && isProduction) {
    throw new Error(
      'USE_IN_MEMORY_DB=true is not allowed when NODE_ENV=production. ' +
        'Set DATABASE_URL to a real Postgres instance.',
    );
  }

  if (wantsInMemory) {
    console.warn('Using the IN-MEMORY store. Data will not survive a restart.');
    return { repo: new InMemoryLeadRepository() };
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill it in, ' +
        'or set USE_IN_MEMORY_DB=true to run without a database.',
    );
  }

  const pool = createPool(connectionString);
  await migrate(pool);
  console.log('Schema ready.');
  return { repo: new PostgresLeadRepository(pool), pool };
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const isProduction = process.env.NODE_ENV === 'production';

  const { repo, pool } = await resolveRepository();

  // Serving the built client is on by default in production; SERVE_CLIENT
  // overrides it either way, which makes the full stack testable locally.
  const serveClient = process.env.SERVE_CLIENT
    ? process.env.SERVE_CLIENT === 'true'
    : isProduction;

  const app = createApp({ repo, serveClient });

  const server = app.listen(port, () => {
    console.log(
      `API listening on port ${port} (${isProduction ? 'production' : 'development'})`,
    );
  });

  // Render sends SIGTERM on redeploy - drain connections before exiting.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => {
      void (pool ? pool.end() : Promise.resolve()).then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error('Failed to start server:', error instanceof Error ? error.message : error);
  process.exit(1);
});
