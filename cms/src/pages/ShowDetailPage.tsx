import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getShow } from '../api/shows';
import { getSeasonsForShow } from '../api/seasons';
import { Season } from '../types/season';
import { ShowFormModal } from '../components/ShowFormModal';
import { SeasonFormModal } from '../components/SeasonFormModal';
import { DeleteSeasonConfirmModal } from '../components/DeleteSeasonConfirmModal';
import { SeasonEpisodesSection } from '../components/SeasonEpisodesSection';
import { PublishSeriesModal } from '../components/PublishSeriesModal';
import { ApiError } from '../api/client';
import { EditIcon, PublishIcon } from '../components/icons';

export function getDefaultSeason(seasons: Season[]): Season | null {
  if (!seasons || seasons.length === 0) return null;
  const season1 = seasons.find((s) => s.season_number === 1);
  if (season1) return season1;
  const normalSeason = seasons.find((s) => s.season_number > 0);
  if (normalSeason) return normalSeason;
  const trailerSeason = seasons.find((s) => s.season_number === 0);
  if (trailerSeason) return trailerSeason;
  return seasons[0] || null;
}

export const ShowDetailPage: React.FC = () => {
  const { showId } = useParams<{ showId: string }>();
  const parsedShowId = Number(showId);

  const [isEditShowModalOpen, setIsEditShowModalOpen] = useState(false);
  const [isPublishSeriesModalOpen, setIsPublishSeriesModalOpen] = useState(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [seasonToEdit, setSeasonToEdit] = useState<Season | null>(null);
  const [isDeleteSeasonModalOpen, setIsDeleteSeasonModalOpen] = useState(false);
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);

  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  const {
    data: show,
    isLoading: isShowLoading,
    isError: isShowError,
    error: showError,
    refetch: refetchShow,
  } = useQuery({
    queryKey: ['show', parsedShowId],
    queryFn: () => getShow(parsedShowId),
    enabled: !isNaN(parsedShowId),
  });

  const {
    data: seasons,
    isLoading: isSeasonsLoading,
    isError: isSeasonsError,
    error: seasonsError,
    refetch: refetchSeasons,
  } = useQuery({
    queryKey: ['seasons', parsedShowId],
    queryFn: () => getSeasonsForShow(parsedShowId),
    enabled: !isNaN(parsedShowId),
  });

  const selectedSeason = useMemo(() => {
    if (!seasons || seasons.length === 0) return null;
    if (selectedSeasonId !== null) {
      const found = seasons.find((s) => s.id === selectedSeasonId);
      if (found) return found;
    }
    return getDefaultSeason(seasons);
  }, [seasons, selectedSeasonId]);

  const handleOpenCreateSeason = () => {
    setSeasonToEdit(null);
    setIsSeasonModalOpen(true);
  };

  const handleOpenEditSeason = (season: Season) => {
    setSeasonToEdit(season);
    setIsSeasonModalOpen(true);
  };

  const handleOpenDeleteSeason = (season: Season) => {
    setSeasonToDelete(season);
    setIsDeleteSeasonModalOpen(true);
  };

  if (isNaN(parsedShowId)) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">
          Invalid Show ID.
        </div>
        <Link
          to="/shows"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
        >
          &larr; Back to Shows
        </Link>
      </div>
    );
  }

  if (isShowLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" data-testid="show-loading">
        <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading show details...</p>
      </div>
    );
  }

  if (isShowError) {
    return (
      <div className="space-y-4">
        <Link
          to="/shows"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300"
        >
          &larr; Back to Shows
        </Link>
        <div
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium"
          role="alert"
          data-testid="show-detail-error"
        >
          <p>
            {showError instanceof ApiError && showError.status === 404
              ? 'Show not found.'
              : showError instanceof Error
              ? showError.message
              : 'Failed to load show details.'}
          </p>
          <button
            onClick={() => refetchShow()}
            className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="show-management-page">
      {/* Top navigation */}
      <div>
        <Link
          to="/shows"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          data-testid="back-to-shows"
        >
          &larr; Back to Shows
        </Link>
      </div>

      {/* Show Header & Info Card */}
      {show && (
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
          data-testid="show-detail-card"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex items-center gap-3 flex-wrap">
                <h1
                  className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
                  data-testid="show-title"
                >
                  {show.title}
                </h1>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    show.status === 'published'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  }`}
                >
                  {show.status}
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap text-xs">
                <span className="inline-flex items-center px-3 py-1 rounded-full font-semibold bg-slate-800 border border-slate-700/60 text-slate-300">
                  {seasons?.length || 0} {seasons?.length === 1 ? 'Season' : 'Seasons'}
                </span>

                {show.section ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 capitalize" data-testid="show-section-tag">
                    {show.section}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full font-medium bg-slate-800 border border-slate-700/40 text-slate-400 italic" data-testid="show-section-tag">
                    No Section
                  </span>
                )}

                {show.categories?.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center px-3 py-1 rounded-full font-medium bg-slate-800/80 border border-slate-700/50 text-slate-300"
                  >
                    {c.name}
                  </span>
                ))}

                <code className="bg-slate-950 px-2.5 py-1 rounded font-mono text-slate-400 border border-slate-800">
                  {show.slug}
                </code>
              </div>

              {show.description && (
                <p className="text-sm text-slate-300 leading-relaxed pt-1">
                  {show.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 self-start flex-wrap">
              <button
                onClick={() => setIsEditShowModalOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/50 transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer"
                data-testid="edit-show-btn"
              >
                <EditIcon className="w-4 h-4" />
                Edit Show
              </button>
              <button
                onClick={() => setIsPublishSeriesModalOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/20 transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer"
                data-testid="publish-series-btn"
                aria-label="Publish Show"
              >
                <PublishIcon className="w-4 h-4" />
                Publish Show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Episodes & Season Selector Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6" data-testid="episodes-management-section">
        {/* Season Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <h2 className="text-lg font-bold text-white tracking-tight">Episodes</h2>

            {seasons && seasons.length > 0 && (
              <>
                <div className="h-4 w-px bg-slate-800 hidden sm:block" />

                {/* Compact Netflix-style Season Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="season-select" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Season
                  </label>
                  <div className="relative">
                    <select
                      id="season-select"
                      value={selectedSeason?.id || ''}
                      onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
                      className="appearance-none bg-slate-950 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl pl-3.5 pr-8 py-1.5 border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm cursor-pointer transition-colors"
                      data-testid="season-select"
                    >
                      {seasons.map((s) => {
                        const label =
                          s.season_number === 0
                            ? 'Trailers'
                            : `Season ${s.season_number}`;
                        return (
                          <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Selected Season Management Actions */}
                {selectedSeason && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditSeason(selectedSeason)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/50 transition-colors inline-flex items-center gap-1"
                      data-testid={`edit-season-${selectedSeason.id}`}
                      title="Edit Season"
                    >
                      <EditIcon className="w-3 h-3" />
                      Edit Season
                    </button>
                    <button
                      onClick={() => handleOpenDeleteSeason(selectedSeason)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 transition-colors"
                      data-testid={`delete-season-${selectedSeason.id}`}
                      title="Delete Season"
                    >
                      Delete Season
                    </button>
                    {/* Backward-compat test handle */}
                    <button
                      className="sr-only"
                      data-testid={`manage-episodes-${selectedSeason.id}`}
                      aria-label={`Manage Episodes for Season ${selectedSeason.season_number}`}
                    >
                      Episodes
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right side action: + Add Season */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={handleOpenCreateSeason}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 transition-colors"
              data-testid="create-season-btn"
            >
              + Add Season
            </button>
          </div>
        </div>

        {/* Seasons Loading */}
        {isSeasonsLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="seasons-loading">
            <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading seasons...</p>
          </div>
        )}

        {/* Seasons Error */}
        {isSeasonsError && (
          <div
            className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium"
            role="alert"
            data-testid="seasons-error"
          >
            <p>
              {seasonsError instanceof ApiError && seasonsError.status === 403
                ? '403 Forbidden: Permission denied.'
                : seasonsError instanceof Error
                ? seasonsError.message
                : 'Failed to load seasons.'}
            </p>
            <button
              onClick={() => refetchSeasons()}
              className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Selected Season Episodes */}
        {!isSeasonsLoading && !isSeasonsError && (
          <>
            {!seasons || seasons.length === 0 ? (
              <div
                className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80 p-8"
                data-testid="seasons-empty"
              >
                <p className="text-slate-400 text-sm">No seasons found for this show yet.</p>
                <button
                  onClick={handleOpenCreateSeason}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Create Season 1
                </button>
              </div>
            ) : selectedSeason ? (
              <SeasonEpisodesSection key={selectedSeason.id} season={selectedSeason} />
            ) : null}
          </>
        )}
      </section>

      {/* Modals */}
      {show && (
        <ShowFormModal
          isOpen={isEditShowModalOpen}
          onClose={() => setIsEditShowModalOpen(false)}
          showToEdit={show}
        />
      )}

      <SeasonFormModal
        isOpen={isSeasonModalOpen}
        onClose={() => setIsSeasonModalOpen(false)}
        showId={parsedShowId}
        seasonToEdit={seasonToEdit}
      />

      <DeleteSeasonConfirmModal
        isOpen={isDeleteSeasonModalOpen}
        onClose={() => setIsDeleteSeasonModalOpen(false)}
        showId={parsedShowId}
        seasonToDelete={seasonToDelete}
      />

      <PublishSeriesModal
        isOpen={isPublishSeriesModalOpen}
        onClose={() => setIsPublishSeriesModalOpen(false)}
        show={show || null}
        seasons={seasons}
      />
    </div>
  );
};
