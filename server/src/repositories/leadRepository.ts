import type {
  CreateLeadInput,
  Lead,
  LeadStatus,
  ListLeadsQuery,
  ListLeadsResult,
} from '../domain';

/**
 * Storage contract for leads.
 *
 * Routes depend on this interface rather than on `pg` directly. That keeps
 * SQL out of the HTTP layer and lets the test suite run against an in-memory
 * implementation with no database process involved.
 */
export interface LeadRepository {
  create(input: CreateLeadInput): Promise<Lead>;
  list(query: ListLeadsQuery): Promise<ListLeadsResult>;
  findById(id: string): Promise<Lead | null>;
  updateStatus(id: string, status: LeadStatus): Promise<Lead | null>;
}

/** Thrown by implementations when the unique email constraint is violated. */
export class DuplicateEmailError extends Error {
  constructor(readonly email: string) {
    super(`A lead with email ${email} already exists`);
    this.name = 'DuplicateEmailError';
  }
}
