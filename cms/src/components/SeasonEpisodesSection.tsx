import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Season } from '../types/season';
import { Episode } from '../types/episode';
import { getEpisodesForSeason, updateEpisode } from '../api/episodes';
import { getEpisodeArtwork } from '../api/artwork';
import { formatArtworkUrl } from '../utils/artwork';
import { EpisodeFormModal } from './EpisodeFormModal';
import { DeleteEpisodeConfirmModal } from './DeleteEpisodeConfirmModal';
import { ApiError } from '../api/client';
import { FilmIcon } from './icons';

const EpisodeThumbnail: React.FC<{ episodeId: string }> = ({ episodeId }) => {
  const { data: artworks } = useQuery({
    queryKey: ['artwork', episodeId],
    queryFn: () => getEpisodeArtwork(episodeId),
    staleTime: 5 * 60 * 1000,
  });

  const thumbArt = artworks?.find(
    (a) => a.artwork_type === 'thumbnail' || a.artwork_type === 'poster' || a.artwork_type === 'banner'
  );

  if (thumbArt?.file_path) {
    return (
      <img
        src={formatArtworkUrl(thumbArt.file_path)}
        alt="Thumbnail"
        className="w-14 h-9 object-cover rounded-md bg-slate-950 border border-slate-800 shrink-0"
        data-testid={`episode-thumb-${episodeId}`}
      />
    );
  }

  return (
    <div
      className="w-14 h-9 rounded-md bg-slate-950 border border-slate-800/80 flex items-center justify-center text-slate-600 shrink-0"
      data-testid={`episode-thumb-${episodeId}`}
    >
      <FilmIcon className="w-4 h-4 text-slate-600" />
    </div>
  );
};

interface SeasonEpisodesSectionProps {
  season: Season;
  onBackToSeasons?: () => void;
  onEpisodesLoaded?: (episodes: Episode[]) => void;
}

export const SeasonEpisodesSection: React.FC<SeasonEpisodesSectionProps> = ({
  season,
  onBackToSeasons,
  onEpisodesLoaded,
}) => {
  const queryClient = useQueryClient();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [episodeToEdit, setEpisodeToEdit] = useState<Episode | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: episodes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['episodes', season.id],
    queryFn: async () => {
      const res = await getEpisodesForSeason(season.id);
      if (onEpisodesLoaded) {
        onEpisodesLoaded(res);
      }
      return res;
    },
  });

  const publishEpisodeMutation = useMutation({
    mutationFn: async (ep: Episode) => {
      setActionError(null);
      return updateEpisode(ep.episode_id, { status: 'published' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes', season.id] });
      queryClient.invalidateQueries({ queryKey: ['catalogStatus'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Failed to publish episode.');
      }
    },
  });

  const handleOpenCreate = () => {
    setEpisodeToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (episode: Episode) => {
    setEpisodeToEdit(episode);
    setIsFormModalOpen(true);
  };

  const handleOpenDelete = (episode: Episode) => {
    setEpisodeToDelete(episode);
    setIsDeleteModalOpen(true);
  };

  const isTrailer = season.season_number === 0;

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0 && secs > 0) {
      return `${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m`;
    }
    return `${secs}s`;
  };

  return (
    <div className="space-y-4" data-testid="season-episodes-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {onBackToSeasons && (
            <button
              onClick={onBackToSeasons}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
              data-testid="back-to-seasons-btn"
            >
              &larr; Back
            </button>
          )}
          <span className="text-sm font-bold text-white tracking-wide">
            {isTrailer ? 'Trailers' : `Season ${season.season_number}`}
          </span>
          <span
            className="text-xs font-semibold text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800"
            data-testid="selected-season-episode-count"
          >
            {episodes?.length || 0} {episodes?.length === 1 ? 'Episode' : 'Episodes'}
          </span>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 self-start sm:self-auto"
          data-testid="create-episode-btn"
        >
          + Add Episode
        </button>
      </div>

      {/* Action Error alert */}
      {actionError && (
        <div
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium"
          role="alert"
          data-testid="episode-action-error"
        >
          {actionError}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="episodes-loading">
          <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading episodes...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium"
          role="alert"
          data-testid="episodes-error"
        >
          <p>
            {error instanceof ApiError && error.status === 403
              ? '403 Forbidden: Permission denied.'
              : error instanceof Error
              ? error.message
              : 'Failed to load episodes for this season.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Episodes Table */}
      {!isLoading && !isError && (
        <>
          {!episodes || episodes.length === 0 ? (
            <div
              className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80"
              data-testid="episodes-empty"
            >
              <p className="text-slate-400 text-sm">No episodes found in this season yet.</p>
              <button
                onClick={handleOpenCreate}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Create Episode #1
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse" data-testid="episodes-table">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 px-3 w-12">#</th>
                    <th className="pb-3 px-3 w-20">Thumbnail</th>
                    <th className="pb-3 px-3">Title</th>
                    <th className="pb-3 px-3 w-24">Language</th>
                    <th className="pb-3 px-3 w-28">Duration</th>
                    <th className="pb-3 px-3 w-28">Status</th>
                    <th className="pb-3 px-3 text-right w-44">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {episodes.map((ep) => {
                    const isDraft = ep.status === 'draft';
                    const isPublishingThis =
                      publishEpisodeMutation.isPending &&
                      publishEpisodeMutation.variables?.episode_id === ep.episode_id;

                    return (
                      <tr
                        key={ep.id}
                        className="hover:bg-slate-800/30 transition-colors"
                        data-testid={`episode-row-${ep.episode_id}`}
                      >
                        <td className="py-3 px-3 font-semibold text-slate-300">
                          {ep.episode_number}
                        </td>
                        <td className="py-3 px-3">
                          <EpisodeThumbnail episodeId={ep.episode_id} />
                        </td>
                        <td className="py-3 px-3">
                          <div
                            className="font-bold text-white text-sm"
                            data-testid={`episode-title-${ep.episode_id}`}
                          >
                            {ep.title}
                          </div>
                          {ep.synopsis && (
                            <small className="text-xs text-slate-400 block line-clamp-1 max-w-md mt-0.5">
                              {ep.synopsis}
                            </small>
                          )}
                          <code className="sr-only" data-testid={`episode-id-${ep.episode_id}`}>
                            {ep.episode_id}
                          </code>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              ep.language === 'en'
                                ? 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
                                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            }`}
                            data-testid={`episode-lang-${ep.episode_id}`}
                          >
                            {ep.language.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 text-xs font-mono">
                          {formatDuration(ep.duration_seconds)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              ep.status === 'published'
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                                : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                            }`}
                            data-testid={`episode-status-${ep.episode_id}`}
                          >
                            {ep.status === 'published' ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(ep)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                              data-testid={`edit-episode-${ep.episode_id}`}
                              title="Edit Episode"
                            >
                              Edit
                            </button>
                            {isDraft && (
                              <button
                                onClick={() => publishEpisodeMutation.mutate(ep)}
                                disabled={publishEpisodeMutation.isPending}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/20 transition-colors disabled:opacity-50"
                                data-testid={`publish-episode-${ep.episode_id}`}
                                title="Publish Episode"
                              >
                                {isPublishingThis ? 'Publishing...' : 'Publish'}
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenDelete(ep)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 transition-colors"
                              data-testid={`delete-episode-${ep.episode_id}`}
                              title="Delete Episode"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <EpisodeFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        seasonId={season.id}
        episodeToEdit={episodeToEdit}
      />

      <DeleteEpisodeConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        seasonId={season.id}
        episodeToDelete={episodeToDelete}
      />
    </div>
  );
};
