import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Episode } from '../types/episode';
import { ArtworkType, Artwork } from '../types/artwork';
import { getEpisodeArtwork, uploadArtwork } from '../api/artwork';
import { ArtworkSlotCard } from './ArtworkSlotCard';
import { DeleteArtworkConfirmModal } from './DeleteArtworkConfirmModal';
import { ApiError } from '../api/client';

interface EpisodeArtworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  episode: Episode | null;
}

export const EpisodeArtworkModal: React.FC<EpisodeArtworkModalProps> = ({
  isOpen,
  onClose,
  episode,
}) => {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<ArtworkType | null>(null);

  const episodeId = episode?.episode_id || '';

  const {
    data: artworks,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['artwork', episodeId],
    queryFn: () => getEpisodeArtwork(episodeId),
    enabled: isOpen && Boolean(episodeId),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ type, file }: { type: ArtworkType; file: File }) => {
      setErrorMessage(null);
      return uploadArtwork(episodeId, type, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artwork', episodeId] });
      setErrorMessage(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to upload artwork.');
      }
    },
  });

  if (!isOpen || !episode) return null;

  // Map existing artworks by artwork_type
  const artworkMap: Partial<Record<ArtworkType, Artwork>> = {};
  artworks?.forEach((art) => {
    artworkMap[art.artwork_type] = art;
  });

  const handleUpload = async (type: ArtworkType, file: File) => {
    await uploadMutation.mutateAsync({ type, file });
  };

  const isBusy = uploadMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" data-testid="episode-artwork-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">Episode Artwork Management</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {episode.title} (<code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300">{episode.episode_id}</code> -{' '}
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 uppercase">
                {episode.language.toUpperCase()}
              </span>
              )
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none p-1 transition-colors"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Error alerts */}
        {errorMessage && (
          <div className="m-6 mb-0 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert" data-testid="artwork-error">
            {errorMessage}
          </div>
        )}

        {isError && (
          <div className="m-6 mb-0 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert" data-testid="artwork-fetch-error">
            <p>
              {error instanceof ApiError && error.status === 403
                ? '403 Forbidden: Permission denied.'
                : error instanceof Error
                ? error.message
                : 'Failed to load episode artwork.'}
            </p>
            <button onClick={() => refetch()} className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold">
              Retry
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="artwork-loading">
              <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Loading artwork details...</p>
            </div>
          )}

          {/* 3 Artwork Slots */}
          {!isLoading && !isError && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="artwork-slots-grid">
              <ArtworkSlotCard
                type="poster"
                episodeId={episodeId}
                artwork={artworkMap.poster}
                onUpload={handleUpload}
                onDeleteRequest={(t) => setTypeToDelete(t)}
                isBusy={isBusy}
              />

              <ArtworkSlotCard
                type="banner"
                episodeId={episodeId}
                artwork={artworkMap.banner}
                onUpload={handleUpload}
                onDeleteRequest={(t) => setTypeToDelete(t)}
                isBusy={isBusy}
              />

              <ArtworkSlotCard
                type="thumbnail"
                episodeId={episodeId}
                artwork={artworkMap.thumbnail}
                onUpload={handleUpload}
                onDeleteRequest={(t) => setTypeToDelete(t)}
                isBusy={isBusy}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-slate-950/40 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteArtworkConfirmModal
        isOpen={Boolean(typeToDelete)}
        onClose={() => setTypeToDelete(null)}
        episodeId={episodeId}
        artworkType={typeToDelete}
      />
    </div>
  );
};
