import { useState } from 'react';
import { LEAD_STATUSES, STATUS_LABELS, type Lead, type LeadStatus } from '../types';

interface LeadTableProps {
  leads: Lead[];
  loading: boolean;
  hasFilters: boolean;
  sort: 'createdAt' | 'name';
  order: 'asc' | 'desc';
  onToggleSort: (column: 'createdAt' | 'name') => void;
  onStatusChange: (id: string, status: LeadStatus) => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function LeadTable({
  leads,
  loading,
  hasFilters,
  sort,
  order,
  onToggleSort,
  onStatusChange,
}: LeadTableProps) {
  // Tracks which row is mid-update so its dropdown can disable itself.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleChange(id: string, status: LeadStatus) {
    setPendingId(id);
    setRowError(null);
    try {
      await onStatusChange(id, status);
    } catch {
      setRowError('Could not update that status. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  function sortIndicator(column: 'createdAt' | 'name') {
    if (sort !== column) return null;
    return <span aria-hidden="true"> {order === 'asc' ? '↑' : '↓'}</span>;
  }

  if (!loading && leads.length === 0) {
    return (
      <div className="card empty-state">
        <p className="empty-title">{hasFilters ? 'No matching leads' : 'No leads yet'}</p>
        <p className="empty-hint">
          {hasFilters
            ? 'Try a different search term or clear the status filter.'
            : 'Add your first lead using the form to get started.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card table-card">
      {rowError && <p className="form-error">{rowError}</p>}

      <div className="table-scroll">
        <table className="lead-table">
          <thead>
            <tr>
              <th scope="col">
                <button type="button" className="sort-button" onClick={() => onToggleSort('name')}>
                  Name
                  {sortIndicator('name')}
                </button>
              </th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              <th scope="col">Status</th>
              <th scope="col">
                <button
                  type="button"
                  className="sort-button"
                  onClick={() => onToggleSort('createdAt')}
                >
                  Created
                  {sortIndicator('createdAt')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className={loading ? 'is-loading' : undefined}>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="cell-name">{lead.name}</td>
                <td className="cell-email">
                  {/* title so the full address is still reachable if the
                      column truncates on a narrow window */}
                  <a href={`mailto:${lead.email}`} className="cell-link" title={lead.email}>
                    {lead.email}
                  </a>
                </td>
                <td className="cell-phone">{lead.phone}</td>
                <td>
                  <label className="sr-only" htmlFor={`status-${lead.id}`}>
                    Status for {lead.name}
                  </label>
                  <select
                    id={`status-${lead.id}`}
                    className={`status-select status-${lead.status}`}
                    value={lead.status}
                    disabled={pendingId === lead.id}
                    onChange={(e) => void handleChange(lead.id, e.target.value as LeadStatus)}
                  >
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="cell-date">{formatDate(lead.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
