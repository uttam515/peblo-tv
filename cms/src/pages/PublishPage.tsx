import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { publishCatalog, getPublishHistory, getCatalogStatus } from '../api/publish';
import { ApiError } from '../api/client';
import {
  PublishSuccessResponse,
  PublishValidationErrorItem,
} from '../types/publish';
import { LockIcon, PublishIcon } from '../components/icons';

export const PublishPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [lastSuccess, setLastSuccess] = useState<PublishSuccessResponse | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<PublishValidationErrorItem[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { data: statusData } = useQuery({
    queryKey: ['catalogStatus'],
    queryFn: getCatalogStatus,
  });

  const {
    data: historyRuns = [],
    isLoading: isHistoryLoading,
    isError: isHistoryError,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['publishHistory'],
    queryFn: () => getPublishHistory(),
    enabled: Boolean(isAdmin),
  });

  const publishMutation = useMutation({
    mutationFn: publishCatalog,
    onMutate: () => {
      setGeneralError(null);
      setValidationErrors([]);
    },
    onSuccess: (data) => {
      const now = new Date();
      setLastSuccess(data);
      setLastPublishedAt(now.toISOString());
      setValidationErrors([]);
      setGeneralError(null);
      queryClient.invalidateQueries({ queryKey: ['publishHistory'] });
      queryClient.invalidateQueries({ queryKey: ['catalogStatus'] });
    },
    onError: (err: any) => {
      setLastSuccess(null);
      queryClient.invalidateQueries({ queryKey: ['publishHistory'] });
      queryClient.invalidateQueries({ queryKey: ['catalogStatus'] });

      if (err instanceof ApiError) {
        if (err.status === 422) {
          const detailErrors =
            err.data?.detail?.errors ||
            err.data?.errors ||
            [];
          setValidationErrors(detailErrors);
          setGeneralError(
            err.data?.detail?.message ||
              err.message ||
              'Catalogue publish validation failed. Please resolve the errors below.'
          );
          return;
        }

        if (err.status === 403) {
          setGeneralError('403 Forbidden: Only administrators have permission to publish the catalogue.');
          return;
        }
      }

      setGeneralError(err?.message || 'An unexpected error occurred while publishing the catalogue.');
    },
  });

  const handlePublish = () => {
    if (publishMutation.isPending) return;
    publishMutation.mutate();
  };

  // Editor role restriction (backend RBAC remains authoritative)
  if (!isAdmin) {
    return (
      <div className="space-y-6" data-testid="publish-page-editor">
        <header className="pb-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white tracking-tight">Publish Catalogue</h1>
          <p className="text-sm text-slate-400 mt-1">Live catalogue deployment and status.</p>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-xl space-y-4" data-testid="permission-denied" role="alert">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <LockIcon className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Permission Denied (403)</h2>
          <p className="text-sm text-slate-300">
            You are signed in as <strong className="text-white">{user?.username}</strong> with role{' '}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 capitalize">{user?.role}</span>.
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Publishing changes to the live catalogue requires administrator permissions.
            Please contact an administrator to deploy catalogue updates.
          </p>
        </div>
      </div>
    );
  }

  const isPending = statusData?.status === 'changes_pending';
  const isNoCatalogue = statusData?.status === 'no_catalogue';

  return (
    <div className="space-y-6" data-testid="publish-page-admin">
      <header className="pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Deploy to Viewer</h1>
          <p className="text-sm text-slate-400 mt-1">
            Deploy the latest published content to make it available in the Viewer.
          </p>
        </div>
      </header>

      {/* 1. VIEWER CONTENT */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4" data-testid="current-live-catalogue-section">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Current Status</span>
            <h3 className="text-lg font-bold text-white mt-0.5">Viewer Content</h3>
          </div>
          <div>
            {statusData?.status === 'live' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Live
              </span>
            )}
            {statusData?.status === 'changes_pending' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Update Pending
              </span>
            )}
            {statusData?.status === 'no_catalogue' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 border border-slate-500/30 text-slate-400 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Not Deployed
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Current Version</span>
            <span className="text-sm font-bold text-indigo-300 font-mono mt-1 block" data-testid="live-catalogue-version">
              {statusData?.catalogue_version || 'None deployed'}
            </span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Last Deployed</span>
            <span className="text-sm font-semibold text-slate-200 mt-1 block" data-testid="live-last-published-time">
              {statusData?.last_published_at
                ? new Date(statusData.last_published_at).toLocaleString()
                : 'Never'}
            </span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Viewer Inventory</span>
            <span className="text-sm font-semibold text-slate-200 mt-1 block" data-testid="live-shows-episodes-count">
              {statusData?.live_shows_count !== undefined && statusData?.live_shows_count !== null
                ? `${statusData.live_shows_count} Shows • ${statusData.live_episodes_count ?? 0} Episodes`
                : 'No active deployment'}
            </span>
          </div>
        </div>
      </section>

      {/* Pre-Publish Status & Guidelines */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4" data-testid="publish-preflight-rules">
        <h3 className="text-base font-bold text-white">Deployment Requirements</h3>
        <p className="text-xs text-slate-400">
          Before deploying content to the Viewer, verify the following:
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
            <div>
              <strong className="text-white">Shows:</strong> Must have status set to <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">published</code> and belong to a section (<code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">featured</code>, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">series</code>, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">minisodes</code>, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">songs</code>).
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
            <div>
              <strong className="text-white">Episodes:</strong> Must have status set to <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">published</code> with a valid duration (<code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 text-xs font-mono">&gt; 0s</code>).
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
            <div>
              <strong className="text-white">Artwork:</strong> Every published episode must have all three artwork types uploaded (Poster 600×900, Banner 1280×720, Thumbnail 640×360).
            </div>
          </li>
        </ul>
      </section>

      {/* 2. PENDING CHANGES & DEPLOYMENT ACTION */}
      <section className="bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-5" data-testid="pending-changes-action-section">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">
                {isPending
                  ? 'Pending Changes'
                  : isNoCatalogue
                  ? 'Initial Viewer Deployment'
                  : 'Viewer Up to Date'}
              </h3>
              {statusData?.pending_changes && statusData.pending_changes.total_changes > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300" data-testid="pending-total-badge">
                  {statusData.pending_changes.total_changes} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
              {isPending
                ? 'Published content has changed since the last Viewer deployment.'
                : isNoCatalogue
                ? 'No content has been deployed to the Viewer yet. Click Deploy to Viewer to make all published content available.'
                : 'All published content and artwork are currently up to date in the Viewer.'}
            </p>
          </div>
          <div>
            <button
              onClick={handlePublish}
              disabled={publishMutation.isPending}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2 whitespace-nowrap min-w-[200px]"
              data-testid="publish-catalog-btn"
            >
              {publishMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Deploying to Viewer...
                </>
              ) : (
                <>
                  <PublishIcon className="w-4 h-4" />
                  Deploy to Viewer
                </>
              )}
            </button>
          </div>
        </div>

        {/* Detailed Pending Changes Summary */}
        {statusData?.pending_changes && (isPending || isNoCatalogue) && (
          <div className="mt-4 pt-4 border-t border-indigo-500/20 space-y-4" data-testid="pending-changes-summary">
            {/* Metric Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Shows Changed</span>
                <span className="text-lg font-extrabold text-white mt-0.5 block" data-testid="pending-shows-count">
                  {statusData.pending_changes.shows_changed}
                </span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Episodes Changed</span>
                <span className="text-lg font-extrabold text-white mt-0.5 block" data-testid="pending-episodes-count">
                  {statusData.pending_changes.episodes_changed}
                </span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Artwork Changed</span>
                <span className="text-lg font-extrabold text-white mt-0.5 block" data-testid="pending-artwork-count">
                  {statusData.pending_changes.artwork_changed}
                </span>
              </div>
              <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-3 text-center bg-indigo-950/30">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">Total Changes</span>
                <span className="text-lg font-extrabold text-indigo-200 mt-0.5 block" data-testid="pending-total-changes">
                  {statusData.pending_changes.total_changes}
                </span>
              </div>
            </div>

            {/* Affected Content Details */}
            {statusData.pending_changes.details && statusData.pending_changes.details.length > 0 && (
              <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3" data-testid="pending-details-list">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Affected Content Breakdown ({statusData.pending_changes.details.length} show{statusData.pending_changes.details.length > 1 ? 's' : ''})
                </h4>
                <div className="divide-y divide-slate-800/60">
                  {statusData.pending_changes.details.map((item, idx) => (
                    <div key={`${item.show_title}-${idx}`} className="py-2.5 first:pt-0 last:pb-0 space-y-1" data-testid={`pending-detail-item-${idx}`}>
                      <span className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        {item.show_title}
                      </span>
                      {item.changes && item.changes.length > 0 && (
                        <ul className="pl-4 space-y-0.5 text-xs text-slate-400">
                          {item.changes.map((c, cIdx) => (
                            <li key={cIdx} className="flex items-center gap-1.5">
                              <span className="text-slate-600">&bull;</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Loading state indicator */}
      {publishMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-8 gap-3 bg-slate-900 border border-slate-800 rounded-2xl" data-testid="publish-loading-state">
          <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Validating content and generating live catalogue structure...</p>
        </div>
      )}

      {/* General / Server Error Alert */}
      {generalError && validationErrors.length === 0 && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium space-y-1" role="alert" data-testid="publish-error-alert">
          <h4 className="font-bold text-rose-200">Publish Error</h4>
          <p>{generalError}</p>
        </div>
      )}

      {/* Validation Failures Report */}
      {validationErrors.length > 0 && (
        <section
          className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-6 shadow-xl space-y-4"
          data-testid="publish-validation-report"
          role="alert"
        >
          <div>
            <h4 className="text-base font-bold text-rose-200">Validation Failed ({validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''})</h4>
            <p className="text-xs text-rose-300/80 mt-0.5">
              The live catalogue was not updated. Please fix the following validation issues before re-publishing:
            </p>
          </div>

          <div className="space-y-2">
            {validationErrors.map((err, idx) => (
              <div
                key={`${err.entity_type}-${err.entity_id}-${idx}`}
                className="bg-slate-900/90 border border-rose-500/20 rounded-xl p-3.5 space-y-1"
                data-testid={`validation-error-${idx}`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 uppercase tracking-wider">
                    {err.entity_type.toUpperCase()}
                  </span>
                  <strong className="text-sm font-semibold text-white">{err.title}</strong>
                </div>
                <p className="text-xs text-rose-300/90 leading-relaxed pl-1">{err.error}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. DEPLOYMENT RESULT */}
      {lastSuccess && (
        <section className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-6" data-testid="publish-success-card">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs rounded-full uppercase tracking-wider">
              DEPLOYED
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-200">Content Deployed to Viewer Successfully</h3>
              <p className="text-xs text-emerald-300/80 mt-0.5">
                The latest published shows, episodes, and artwork are now live in the Viewer.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Deployed Version</span>
              <span className="block text-base font-bold text-indigo-300 font-mono mt-1" data-testid="success-catalogue-version">
                {lastSuccess.catalogue_version || 'N/A'}
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Live Shows</span>
              <span className="block text-2xl font-extrabold text-white mt-1" data-testid="success-shows-count">
                {lastSuccess.shows_count}
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Live Episodes</span>
              <span className="block text-2xl font-extrabold text-white mt-1" data-testid="success-episodes-count">
                {lastSuccess.episodes_count}
              </span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Deployed At</span>
              <span className="block text-xs font-semibold text-slate-300 mt-2" data-testid="success-published-at">
                {lastPublishedAt ? new Date(lastPublishedAt).toLocaleTimeString() : 'Just now'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Deployment History Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4" data-testid="publish-history-section">
        <div>
          <h3 className="text-lg font-bold text-white">Deployment History</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Log of recent live deployments to the Viewer.
          </p>
        </div>

        {/* History Loading State */}
        {isHistoryLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="publish-history-loading">
            <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading publish history...</p>
          </div>
        )}

        {/* History Error State */}
        {isHistoryError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert" data-testid="publish-history-error">
            <p>
              {historyError instanceof Error
                ? historyError.message
                : 'Failed to load publish history.'}
            </p>
            <button
              onClick={() => refetchHistory()}
              className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              data-testid="history-retry-btn"
            >
              Retry
            </button>
          </div>
        )}

        {/* History Content */}
        {!isHistoryLoading && !isHistoryError && (
          <>
            {historyRuns.length === 0 ? (
              <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80" data-testid="publish-history-empty">
                <p className="text-slate-400 text-sm">No publish runs recorded yet.</p>
                <p className="text-slate-500 text-xs mt-1">
                  Click &quot;Publish Live Catalogue&quot; above to initiate a publish run.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse" data-testid="publish-history-table">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Triggered By</th>
                      <th className="py-3 px-3">Version</th>
                      <th className="py-3 px-3">Shows</th>
                      <th className="py-3 px-3">Episodes</th>
                      <th className="py-3 px-3">Started At</th>
                      <th className="py-3 px-3">Completed At</th>
                      <th className="py-3 px-3">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {historyRuns.map((run, idx) => (
                      <tr key={run.id || idx} className="hover:bg-slate-800/30 transition-colors" data-testid={`history-row-${idx}`}>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              run.status === 'success'
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-200 font-medium">{run.triggered_by || '—'}</td>
                        <td className="py-3 px-3">
                          {run.catalogue_version ? (
                            <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs">{run.catalogue_version}</code>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-300">{run.shows_count ?? 0}</td>
                        <td className="py-3 px-3 font-semibold text-slate-300">{run.episodes_count ?? 0}</td>
                        <td className="py-3 px-3 text-slate-400 text-xs">
                          {run.started_at ? new Date(run.started_at).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-xs">
                          {run.completed_at ? new Date(run.completed_at).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-300 text-xs">{run.summary || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
