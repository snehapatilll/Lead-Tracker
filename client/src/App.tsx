import { LeadForm } from './components/LeadForm';
import { LeadTable } from './components/LeadTable';
import { Pagination } from './components/Pagination';
import { Toolbar } from './components/Toolbar';
import { useLeads } from './lib/useLeads';

export function App() {
  const {
    leads,
    total,
    page,
    pageSize,
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
  } = useLeads();

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">Lead Tracker</h1>
          <p className="app-subtitle">Capture leads and move them through the pipeline.</p>
        </div>
      </header>

      <main className="layout">
        <aside className="layout-side">
          <LeadForm onCreate={createLead} />
        </aside>

        <section className="layout-main">
          <Toolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            total={total}
            loading={loading}
          />

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <LeadTable
            leads={leads}
            loading={loading}
            hasFilters={Boolean(search || statusFilter)}
            sort={sort}
            order={order}
            onToggleSort={toggleSort}
            onStatusChange={updateStatus}
          />

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </section>
      </main>
    </div>
  );
}
