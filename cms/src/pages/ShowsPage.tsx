import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getShows } from '../api/shows';
import { Show } from '../types/show';
import { ShowFormModal } from '../components/ShowFormModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { ApiError } from '../api/client';

export const ShowsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [showToEdit, setShowToEdit] = useState<Show | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showToDelete, setShowToDelete] = useState<Show | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['shows', { q: search, section: sectionFilter, status: statusFilter, page, pageSize }],
    queryFn: () =>
      getShows({
        q: search.trim() || undefined,
        section: sectionFilter || undefined,
        status: statusFilter || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSectionFilter(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleOpenCreate = () => {
    setShowToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (show: Show) => {
    setShowToEdit(show);
    setIsFormModalOpen(true);
  };

  const handleOpenDelete = (show: Show) => {
    setShowToDelete(show);
    setIsDeleteModalOpen(true);
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const shows = data?.results ?? [];

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Shows Management</h1>
          <p className="text-sm text-slate-400 mt-1">Create, update, and manage catalogue shows.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 self-start sm:self-auto"
          data-testid="create-show-btn"
        >
          + Create Show
        </button>
      </header>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search shows by title..."
            value={search}
            onChange={handleSearchChange}
            data-testid="search-input"
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
          />
        </div>

        <div>
          <select
            value={sectionFilter}
            onChange={handleSectionChange}
            data-testid="section-filter"
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">All Sections</option>
            <option value="featured">Featured</option>
            <option value="series">Series</option>
            <option value="minisodes">Minisodes</option>
            <option value="songs">Songs</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            data-testid="status-filter"
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert" data-testid="shows-error">
          <p>
            {error instanceof ApiError && error.status === 403
              ? '403 Forbidden: You do not have permission to view shows.'
              : error instanceof Error
              ? error.message
              : 'Failed to load shows from the server.'}
          </p>
          <button onClick={() => refetch()} className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3" data-testid="shows-loading">
          <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading shows...</p>
        </div>
      )}

      {/* Shows Table */}
      {!isLoading && !isError && (
        <>
          {shows.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/60 rounded-2xl border border-slate-800/80" data-testid="shows-empty">
              <p className="text-slate-400 text-sm">No shows found matching your criteria.</p>
              {(search || sectionFilter || statusFilter) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSectionFilter('');
                    setStatusFilter('');
                    setPage(1);
                  }}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse" data-testid="shows-table">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                      <th className="py-3.5 px-4">Title</th>
                      <th className="py-3.5 px-4">Slug</th>
                      <th className="py-3.5 px-4">Section</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Categories</th>
                      <th className="py-3.5 px-4">Updated</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {shows.map((show) => (
                      <tr key={show.id} className="hover:bg-slate-800/30 transition-colors" data-testid={`show-row-${show.id}`}>
                        <td className="py-3.5 px-4 font-semibold">
                          <Link
                            to={`/shows/${show.id}`}
                            className="text-white hover:text-indigo-400 transition-colors"
                            data-testid={`show-link-${show.id}`}
                          >
                            {show.title}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <code className="bg-slate-950 px-2 py-0.5 rounded text-indigo-300 font-mono text-xs">{show.slug}</code>
                        </td>
                        <td className="py-3.5 px-4">
                          {show.section ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                              {show.section}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              show.status === 'published'
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                            }`}
                          >
                            {show.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {show.categories && show.categories.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {show.categories.map((c) => (
                                <span key={c.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-xs">{formatDate(show.updated_at)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              to={`/shows/${show.id}`}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/20 transition-colors"
                              data-testid={`view-show-${show.id}`}
                              title="View Show & Seasons"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => handleOpenEdit(show)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                              data-testid={`edit-show-${show.id}`}
                              title="Edit Show"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleOpenDelete(show)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 transition-colors"
                              data-testid={`delete-show-${show.id}`}
                              title="Delete Show"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2" data-testid="pagination-bar">
            <span className="text-xs text-slate-400">
              Showing page <strong className="text-white font-semibold">{page}</strong> of <strong className="text-white font-semibold">{totalPages}</strong> ({total} total shows)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                data-testid="prev-page-btn"
              >
                &larr; Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition-colors"
                data-testid="next-page-btn"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <ShowFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        showToEdit={showToEdit}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        showToDelete={showToDelete}
      />
    </div>
  );
};
