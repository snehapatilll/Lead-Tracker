import { LEAD_STATUSES, STATUS_LABELS, type LeadStatus } from '../types';

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: LeadStatus | '';
  onStatusFilterChange: (value: LeadStatus | '') => void;
  total: number;
  loading: boolean;
}

export function Toolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  total,
  loading,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="search-wrapper">
        <label className="sr-only" htmlFor="search">
          Search leads
        </label>
        <input
          id="search"
          type="search"
          className="search-input"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, email or phone..."
          autoComplete="off"
        />
      </div>

      <div className="filter-wrapper">
        <label className="sr-only" htmlFor="status-filter">
          Filter by status
        </label>
        <select
          id="status-filter"
          className="status-filter"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as LeadStatus | '')}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <p className="result-count" aria-live="polite">
        {loading ? 'Loading...' : `${total} ${total === 1 ? 'lead' : 'leads'}`}
      </p>
    </div>
  );
}
