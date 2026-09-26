import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, type ListLeadsParams } from './api';
import type { CreateLeadPayload, Lead, LeadStatus, ListLeadsResponse } from '../types';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

/** Delays propagating a fast-changing value - used to avoid a request per keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export interface UseLeadsResult {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  statusFilter: LeadStatus | '';
  setStatusFilter: (value: LeadStatus | '') => void;
  sort: NonNullable<ListLeadsParams['sort']>;
  order: NonNullable<ListLeadsParams['order']>;
  toggleSort: (column: NonNullable<ListLeadsParams['sort']>) => void;
  setPage: (page: number) => void;
  createLead: (payload: CreateLeadPayload) => Promise<Lead>;
  updateStatus: (id: string, status: LeadStatus) => Promise<void>;
}

/**
 * Owns all list state: search text, status filter, sorting, pagination and
 * the fetch lifecycle. Components stay presentational.
 */
export function useLeads(): UseLeadsResult {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [sort, setSort] = useState<NonNullable<ListLeadsParams['sort']>>('createdAt');
  const [order, setOrder] = useState<NonNullable<ListLeadsParams['order']>>('desc');
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ListLeadsResponse>({
    leads: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  // Narrowing the result set can strand the user on a page that no longer
  // exists, so any filter change resets to the first page.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    api
      .listLeads(
        { search: debouncedSearch, status: statusFilter, page, pageSize: PAGE_SIZE, sort, order },
        controller.signal,
      )
      .then((result) => {
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name === 'AbortError') return; // superseded, ignore
        setError(err instanceof ApiRequestError ? err.message : 'Something went wrong');
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, statusFilter, page, sort, order, refreshToken]);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  const createLead = useCallback(
    async (payload: CreateLeadPayload) => {
      const lead = await api.createLead(payload);
      // Re-fetch rather than splicing locally: the new lead may not belong on
      // the current page under the active search, filter and sort.
      refresh();
      return lead;
    },
    [refresh],
  );

  const updateStatus = useCallback(async (id: string, status: LeadStatus) => {
    const updated = await api.updateLeadStatus(id, status);
    setData((current) => ({
      ...current,
      leads: current.leads.map((lead) => (lead.id === id ? updated : lead)),
    }));
  }, []);

  const toggleSort = useCallback(
    (column: NonNullable<ListLeadsParams['sort']>) => {
      if (column === sort) {
        setOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      } else {
        setSort(column);
        setOrder(column === 'name' ? 'asc' : 'desc');
      }
    },
    [sort],
  );

  return {
    leads: data.leads,
    total: data.total,
    page,
    pageSize: PAGE_SIZE,
    loading,
    error,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sort,
    order,
    toggleSort,
    setPage,
    createLead,
    updateStatus,
  };
}
