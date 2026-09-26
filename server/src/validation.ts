import { z } from 'zod';
import { LEAD_STATUSES } from './domain';

/**
 * Phone numbers vary too much by locale to validate strictly, so we accept
 * digits plus the usual separators and enforce a sane length rather than
 * rejecting legitimate international formats.
 */
const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Phone must be at least 7 characters')
  .max(20, 'Phone must be at most 20 characters')
  .regex(/^[+()\-.\s\d]+$/, 'Phone may only contain digits and + ( ) - . spaces');

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Must be a valid email').max(254),
  phone: phoneSchema,
  status: z.enum(LEAD_STATUSES).default('new'),
});

export const updateStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
});

export const listLeadsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Lead id must be a UUID'),
});

/** Flattens a zod error into `{ field: message }` for the API response. */
export function formatZodError(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
