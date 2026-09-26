/**
 * Mirrors `server/src/domain.ts`.
 *
 * Deliberately duplicated rather than extracted into a shared workspace: a
 * third package would add a build step to every deploy for ~30 lines of
 * types. The API contract is covered by the server test suite, and the two
 * files are small enough to keep in step by hand. See README "Trade-offs".
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
  createdAt: string;
}

export interface ListLeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateLeadPayload {
  name: string;
  email: string;
  phone: string;
  status?: LeadStatus;
}

/** Human-readable labels for the status workflow. */
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
};
