import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ApiError } from './errors';
import type { LeadRepository } from './repositories/leadRepository';
import { createLeadsRouter } from './routes/leads';
import { LEAD_STATUSES } from './domain';

export interface AppOptions {
  repo: LeadRepository;
  /** Serve the built React bundle from the same process (production). */
  serveClient?: boolean;
}

export function createApp({ repo, serveClient = false }: AppOptions) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // Used by Render's health check and handy for smoke-testing a deploy.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', statuses: LEAD_STATUSES });
  });

  app.use('/api/leads', createLeadsRouter(repo));

  // Any unmatched /api path is a JSON 404, never the SPA shell.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });

  if (serveClient) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    // SPA fallback: client-side routing gets index.html.
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({
        error: { message: err.message, code: err.code, details: err.details },
      });
      return;
    }

    // Unexpected - log it server-side, return something generic.
    console.error('[unhandled]', err);
    res.status(500).json({
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    });
  };
  app.use(errorHandler);

  return app;
}
