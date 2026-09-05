import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getCatalogStatus, getPublishHistory } from '../api/publish';
import { ShowsIcon, TvIcon, AlertIcon, PublishIcon } from '../components/icons';

export const DashboardPage: React.FC = () => {
  const { isAdmin } = useAuth();

  const {
    data: statusData,
    isLoading: isStatusLoading,
    isError: isStatusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['catalogStatus'],
    queryFn: getCatalogStatus,
  });

  const {
    data: historyRuns = [],
    isLoading: isHistoryLoading,
  } = useQuery({
    queryKey: ['publishHistory'],
    queryFn: () => getPublishHistory(5),
    enabled: Boolean(isAdmin),
  });

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'live':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider"
            data-testid="dashboard-status-live"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Live
          </span>
        );
      case 'changes_pending':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wider"
            data-testid="dashboard-status-pending"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Update Pending
          </span>
        );
      case 'no_catalogue':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 border border-slate-500/30 text-slate-400 uppercase tracking-wider"
            data-testid="dashboard-status-none"
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Not Deployed
          </span>
        );
    }
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return `${d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return ts;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Operational Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time overview of content inventory, Viewer publication state, and system operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/shows"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
          >
            <ShowsIcon className="w-4 h-4" />
            Manage Shows &rarr;
          </Link>
          {isAdmin && (
            <Link
              to="/publish"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all inline-flex items-center gap-2"
            >
              <PublishIcon className="w-4 h-4" />
              Deploy to Viewer
            </Link>
          )}
        </div>
      </header>

      {/* Loading state */}
      {isStatusLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="dashboard-loading">
          <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading operational metrics...</p>
        </div>
      )}

      {/* Error state */}
      {isStatusError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert">
          <p>Failed to load operational metrics from the server.</p>
          <button
            onClick={() => refetchStatus()}
            className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Metrics Grid */}
      {!isStatusLoading && !isStatusError && statusData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shows Inventory Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4" data-testid="card-shows">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Shows Inventory</span>
                <ShowsIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-white" data-testid="total-shows-count">
                  {statusData.shows_count.total}
                </span>
                <span className="text-xs text-slate-400 block">Database Shows</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">Published</span>
                  <span className="text-lg font-bold text-white mt-0.5 block" data-testid="published-shows-count">
                    {statusData.shows_count.published}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">Draft</span>
                  <span className="text-lg font-bold text-white mt-0.5 block" data-testid="draft-shows-count">
                    {statusData.shows_count.draft}
                  </span>
                </div>
              </div>
            </div>

            {/* Episodes Inventory Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4" data-testid="card-episodes">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Episode Inventory</span>
                <TvIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-white" data-testid="total-episodes-count">
                  {statusData.episodes_count.total}
                </span>
                <span className="text-xs text-slate-400 block">Episode Records</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold block truncate" title="Unique Episodes">Unique Episodes</span>
                  <span className="text-base font-bold text-white mt-0.5 block" data-testid="unique-episodes-count">
                    {statusData.episodes_count.unique ?? statusData.episodes_count.total}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block truncate" title="Published Episodes">Published Episodes</span>
                  <span className="text-base font-bold text-white mt-0.5 block" data-testid="published-episodes-count">
                    {statusData.episodes_count.published}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block truncate" title="Draft Episodes">Draft Episodes</span>
                  <span className="text-base font-bold text-white mt-0.5 block" data-testid="draft-episodes-count">
                    {statusData.episodes_count.draft}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Viewer Content Status Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between" data-testid="card-catalogue-status">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Viewer Content</span>
                  {renderStatusBadge(statusData.status)}
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Version:</span>
                    {statusData.catalogue_version ? (
                      <code className="bg-slate-950 px-2 py-0.5 rounded text-indigo-300 font-mono" data-testid="dashboard-catalogue-version">
                        {statusData.catalogue_version}
                      </code>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Last Deployed:</span>
                    <span className="text-slate-300 font-medium" data-testid="dashboard-last-published">
                      {formatTimestamp(statusData.last_published_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400 font-medium">Viewer Episodes:</span>
                    <span className="text-indigo-300 font-semibold" data-testid="dashboard-live-entries">
                      {statusData.live_episodes_count !== undefined && statusData.live_episodes_count !== null
                        ? `${statusData.live_episodes_count} Live Catalogue Episodes`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {isAdmin && statusData.status === 'changes_pending' && (
                <div className="pt-3 border-t border-slate-800">
                  <Link
                    to="/publish"
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    Deploy to Viewer &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Candidate Validation Errors Notice (if any) */}
          {statusData.validation_errors && statusData.validation_errors.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 shadow-lg space-y-3" data-testid="dashboard-validation-warnings">
              <div className="flex items-center gap-2">
                <AlertIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <h3 className="text-sm font-bold text-amber-200">
                  Published Content Validation Notice ({statusData.validation_errors.length} issue{statusData.validation_errors.length > 1 ? 's' : ''})
                </h3>
              </div>
              <p className="text-xs text-amber-300/80">
                The following published content requires attention before deploying updates to the Viewer:
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2">
                {statusData.validation_errors.map((item, idx) => (
                  <div key={idx} className="bg-slate-950/60 p-2 rounded-lg border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
                    <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      {item.entity_type}
                    </span>
                    <span>
                      <strong>{item.title}</strong>: {item.error}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Publish History (Admin View) */}
          {isAdmin && (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4" data-testid="dashboard-history-section">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Recent Publish History</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Audit log of recent live catalogue deployments.</p>
                </div>
                <Link to="/publish" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                  Full History &rarr;
                </Link>
              </div>

              {isHistoryLoading ? (
                <div className="text-center py-6 text-slate-400 text-xs">Loading history...</div>
              ) : historyRuns.length === 0 ? (
                <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  No live catalogue publish runs recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 uppercase tracking-wider text-slate-400 bg-slate-950/40">
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Version</th>
                        <th className="py-2.5 px-3">Shows</th>
                        <th className="py-2.5 px-3">Episodes</th>
                        <th className="py-2.5 px-3">Triggered By</th>
                        <th className="py-2.5 px-3">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {historyRuns.map((run, idx) => (
                        <tr key={run.id || idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                run.status === 'success'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-indigo-300">
                            {run.catalogue_version || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-200">{run.shows_count ?? 0}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-200">{run.episodes_count ?? 0}</td>
                          <td className="py-2.5 px-3 text-slate-300">{run.triggered_by || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-400">{formatTimestamp(run.completed_at || run.started_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
