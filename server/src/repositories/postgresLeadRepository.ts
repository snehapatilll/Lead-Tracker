import type { Pool } from 'pg';
import type {
  CreateLeadInput,
  Lead,
  LeadStatus,
  ListLeadsQuery,
  ListLeadsResult,
} from '../domain';
import { DuplicateEmailError, type LeadRepository } from './leadRepository';

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  created_at: Date;
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Sort keys are mapped through a whitelist because column names cannot be
 * parameterised - interpolating the request value directly would be an
 * injection vector.
 */
const SORT_COLUMNS: Record<ListLeadsQuery['sort'], string> = {
  createdAt: 'created_at',
  name: 'name',
};

const UNIQUE_VIOLATION = '23505';

export class PostgresLeadRepository implements LeadRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateLeadInput): Promise<Lead> {
    try {
      const { rows } = await this.pool.query<LeadRow>(
        `INSERT INTO leads (name, email, phone, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, phone, status, created_at`,
        [input.name, input.email, input.phone, input.status],
      );
      return toLead(rows[0]!);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new DuplicateEmailError(input.email);
      }
      throw error;
    }
  }

  async list(query: ListLeadsQuery): Promise<ListLeadsResult> {
    const column = SORT_COLUMNS[query.sort];
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    const searchTerm = query.search ? `%${query.search}%` : null;
    const offset = (query.page - 1) * query.pageSize;

    // COUNT(*) OVER() returns the pre-pagination total in the same round trip.
    const { rows } = await this.pool.query<LeadRow & { total_count: string }>(
      `SELECT id, name, email, phone, status, created_at,
              COUNT(*) OVER() AS total_count
         FROM leads
        WHERE ($1::text IS NULL OR name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
          AND ($2::text IS NULL OR status = $2)
        ORDER BY ${column} ${direction}, id ASC
        LIMIT $3 OFFSET $4`,
      [searchTerm, query.status ?? null, query.pageSize, offset],
    );

    return {
      leads: rows.map(toLead),
      total: rows.length > 0 ? Number(rows[0]!.total_count) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: string): Promise<Lead | null> {
    const { rows } = await this.pool.query<LeadRow>(
      `SELECT id, name, email, phone, status, created_at FROM leads WHERE id = $1`,
      [id],
    );
    return rows[0] ? toLead(rows[0]) : null;
  }

  async updateStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    const { rows } = await this.pool.query<LeadRow>(
      `UPDATE leads SET status = $2
        WHERE id = $1
        RETURNING id, name, email, phone, status, created_at`,
      [id, status],
    );
    return rows[0] ? toLead(rows[0]) : null;
  }
}
