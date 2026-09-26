import type {
  CreateLeadPayload,
  Lead,
  LeadStatus,
  ListLeadsResponse,
} from '../types';

/**
 * The client is served from the same origin as the API in production, and
 * Vite proxies /api to the Express port in development, so a relative base
 * URL works in both environments with no build-time configuration.
 */
const BASE_URL = '/api';

/** Error carrying the server's field-level validation details, when present. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface ErrorBody {
  error?: { message?: string; details?: Record<string, string> };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE_URL + path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch (error) {
    // An aborted request is a normal part of superseding an in-flight search,
    // so it must propagate untouched rather than surface as a network error.
    if ((error as Error)?.name === 'AbortError') throw error;
    // fetch only rejects on network-level failure, never on a 4xx/5xx.
    throw new ApiRequestError(0, 'Could not reach the server. Is it running?');
  }

  if (!response.ok) {
    let body: ErrorBody = {};
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // Non-JSON error body (proxy error page, etc.) - fall through.
    }
    throw new ApiRequestError(
      response.status,
      body.error?.message ?? `Request failed with status ${response.status}`,
      body.error?.details,
    );
  }

  return (await response.json()) as T;
}

export interface ListLeadsParams {
  search?: string;
  status?: LeadStatus | '';
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}

export const api = {
  listLeads(params: ListLeadsParams, signal?: AbortSignal): Promise<ListLeadsResponse> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);

    const qs = query.toString();
    return request<ListLeadsResponse>(`/leads${qs ? `?${qs}` : ''}`, { signal });
  },

  async createLead(payload: CreateLeadPayload): Promise<Lead> {
    const { lead } = await request<{ lead: Lead }>('/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return lead;
  },

  async updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
    const { lead } = await request<{ lead: Lead }>(`/leads/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return lead;
  },
};
