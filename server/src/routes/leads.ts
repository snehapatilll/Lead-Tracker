import { Router, type RequestHandler } from 'express';
import { ApiError } from '../errors';
import {
  DuplicateEmailError,
  type LeadRepository,
} from '../repositories/leadRepository';
import {
  createLeadSchema,
  idParamSchema,
  listLeadsQuerySchema,
  updateStatusSchema,
  formatZodError,
} from '../validation';

/**
 * Express 4 does not forward rejected promises to the error handler, so every
 * async handler is wrapped to `next(err)` explicitly.
 */
function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createLeadsRouter(repo: LeadRepository): Router {
  const router = Router();

  // POST /api/leads - create a lead
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        throw ApiError.badRequest('Validation failed', formatZodError(parsed.error));
      }

      try {
        const lead = await repo.create(parsed.data);
        res.status(201).json({ lead });
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          throw ApiError.conflict(error.message);
        }
        throw error;
      }
    }),
  );

  // GET /api/leads - list with optional search, status filter, sort, pagination
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = listLeadsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw ApiError.badRequest('Invalid query parameters', formatZodError(parsed.error));
      }

      const result = await repo.list(parsed.data);
      res.json(result);
    }),
  );

  // GET /api/leads/:id - fetch a single lead
  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = idParamSchema.safeParse(req.params);
      if (!parsed.success) {
        throw ApiError.badRequest('Invalid lead id', formatZodError(parsed.error));
      }

      const lead = await repo.findById(parsed.data.id);
      if (!lead) throw ApiError.notFound('Lead not found');

      res.json({ lead });
    }),
  );

  // PATCH /api/leads/:id/status - move a lead through the pipeline
  router.patch(
    '/:id/status',
    asyncHandler(async (req, res) => {
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        throw ApiError.badRequest('Invalid lead id', formatZodError(params.error));
      }

      const body = updateStatusSchema.safeParse(req.body);
      if (!body.success) {
        throw ApiError.badRequest('Validation failed', formatZodError(body.error));
      }

      const lead = await repo.updateStatus(params.data.id, body.data.status);
      if (!lead) throw ApiError.notFound('Lead not found');

      res.json({ lead });
    }),
  );

  return router;
}
