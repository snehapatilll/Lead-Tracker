import { randomUUID } from 'node:crypto';
import type {
  CreateLeadInput,
  Lead,
  LeadStatus,
  ListLeadsQuery,
  ListLeadsResult,
} from '../domain';
import { DuplicateEmailError, type LeadRepository } from './leadRepository';

/**
 * In-memory implementation used by the test suite.
 *
 * It deliberately mirrors the Postgres implementation's observable behaviour
 * (case-insensitive search across three columns, unique email, newest-first
 * default ordering) so tests written against it stay meaningful.
 */
export class InMemoryLeadRepository implements LeadRepository {
  private readonly leads = new Map<string, Lead>();

  async create(input: CreateLeadInput): Promise<Lead> {
    const email = input.email.toLowerCase();
    for (const existing of this.leads.values()) {
      if (existing.email === email) throw new DuplicateEmailError(email);
    }

    const lead: Lead = {
      id: randomUUID(),
      name: input.name,
      email,
      phone: input.phone,
      status: input.status,
      createdAt: new Date().toISOString(),
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  async list(query: ListLeadsQuery): Promise<ListLeadsResult> {
    let rows = [...this.leads.values()];

    if (query.search) {
      const needle = query.search.toLowerCase();
      rows = rows.filter(
        (lead) =>
          lead.name.toLowerCase().includes(needle) ||
          lead.email.toLowerCase().includes(needle) ||
          lead.phone.toLowerCase().includes(needle),
      );
    }

    if (query.status) {
      rows = rows.filter((lead) => lead.status === query.status);
    }

    const direction = query.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const cmp =
        query.sort === 'name'
          ? a.name.localeCompare(b.name)
          : a.createdAt.localeCompare(b.createdAt);
      // Tie-break on id so pagination is stable when timestamps collide.
      return cmp !== 0 ? cmp * direction : a.id.localeCompare(b.id);
    });

    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      leads: rows.slice(start, start + query.pageSize),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string): Promise<Lead | null> {
    return this.leads.get(id) ?? null;
  }

  async updateStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    const existing = this.leads.get(id);
    if (!existing) return null;

    const updated: Lead = { ...existing, status };
    this.leads.set(id, updated);
    return updated;
  }

  /** Test helper - not part of the repository contract. */
  clear(): void {
    this.leads.clear();
  }
}
