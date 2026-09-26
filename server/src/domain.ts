/**
 * Core domain types for the Lead Tracker.
 *
 * `LEAD_STATUSES` is the single source of truth for the status workflow: the
 * zod schemas, the Postgres CHECK constraint and the client dropdown are all
 * derived from it, so adding a status means changing one line here plus one
 * migration.
 */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface CreateLeadInput {
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
}

export interface ListLeadsQuery {
  /** Free-text match against name, email and phone. */
  search?: string;
  status?: LeadStatus;
  page: number;
  pageSize: number;
  sort: 'createdAt' | 'name';
  order: 'asc' | 'desc';
}

export interface ListLeadsResult {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}
