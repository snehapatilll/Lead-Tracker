import 'dotenv/config';
import { createApp } from './app';
import { createPool, migrate } from './db';
import { PostgresLeadRepository } from './repositories/postgresLeadRepository';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  const port = Number(process.env.PORT ?? 3000);
  const isProduction = process.env.NODE_ENV === 'production';

  const pool = createPool(connectionString);
  await migrate(pool);
  console.log('Schema ready.');

  const app = createApp({
    repo: new PostgresLeadRepository(pool),
    serveClient: isProduction,
  });

  const server = app.listen(port, () => {
    console.log(`API listening on port ${port} (${isProduction ? 'production' : 'development'})`);
  });

  // Render sends SIGTERM on redeploy - drain connections before exiting.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
