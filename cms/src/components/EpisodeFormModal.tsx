import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Episode, LanguageType, EpisodeStatus } from '../types/episode';
import { createEpisode, updateEpisode } from '../api/episodes';
import { getEpisodeArtwork } from '../api/artwork';
import { Artwork, ArtworkType, ARTWORK_SPECS } from '../types/artwork';
import { formatArtworkUrl } from '../utils/artwork';
import { EpisodeArtworkModal } from './EpisodeArtworkModal';
import { ImageIcon } from './icons';
import { ApiError } from '../api/client';

interface EpisodeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonId: number;
  episodeToEdit: Episode | null;
}

export const EpisodeFormModal: React.FC<EpisodeFormModalProps> = ({
  isOpen,
  onClose,
  seasonId,
  episodeToEdit,
}) => {
  const queryClient = useQueryClient();

  const [episodeId, setEpisodeId] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState<string>('1');
  const [title, setTitle] = useState('');
  const [contentGroup, setContentGroup] = useState('');
  const [language, setLanguage] = useState<LanguageType>('en');
  const [status, setStatus] = useState<EpisodeStatus>('draft');
  const [durationSeconds, setDurationSeconds] = useState<string>('');
  const [synopsis, setSynopsis] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isArtworkModalOpen, setIsArtworkModalOpen] = useState(false);

  const isEditing = Boolean(episodeToEdit);

  const { data: artworks } = useQuery({
    queryKey: ['artwork', episodeToEdit?.episode_id],
    queryFn: () => getEpisodeArtwork(episodeToEdit!.episode_id),
    enabled: isOpen && isEditing && Boolean(episodeToEdit?.episode_id),
  });

  const artworkMap: Partial<Record<ArtworkType, Artwork>> = {};
  artworks?.forEach((art) => {
    artworkMap[art.artwork_type] = art;
  });


  useEffect(() => {
    if (episodeToEdit) {
      setEpisodeId(episodeToEdit.episode_id || '');
      setEpisodeNumber(String(episodeToEdit.episode_number || 1));
      setTitle(episodeToEdit.title || '');
      setContentGroup(episodeToEdit.content_group || '');
      setLanguage(episodeToEdit.language || 'en');
      setStatus(episodeToEdit.status || 'draft');
      setDurationSeconds(
        episodeToEdit.duration_seconds !== null && episodeToEdit.duration_seconds !== undefined
          ? String(episodeToEdit.duration_seconds)
          : ''
      );
      setSynopsis(episodeToEdit.synopsis || '');
    } else {
      setEpisodeId('');
      setEpisodeNumber('1');
      setTitle('');
      setContentGroup('');
      setLanguage('en');
      setStatus('draft');
      setDurationSeconds('');
      setSynopsis('');
    }
    setErrorMessage(null);
  }, [episodeToEdit, isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      const num = parseInt(episodeNumber, 10);
      if (isNaN(num) || num < 1) {
        throw new Error('Episode number must be an integer 1 or greater.');
      }

      const dur = durationSeconds.trim() !== '' ? parseInt(durationSeconds, 10) : null;
      if (dur !== null && (isNaN(dur) || dur < 0)) {
        throw new Error('Duration must be 0 seconds or greater.');
      }

      if (status === 'published' && (dur === null || dur < 0)) {
        throw new Error('Published episodes must have a valid duration in seconds.');
      }

      const payload = {
        episode_id: episodeId.trim(),
        episode_number: num,
        title: title.trim(),
        content_group: contentGroup.trim(),
        language,
        status,
        duration_seconds: dur,
        synopsis: synopsis.trim() || null,
      };

      if (isEditing && episodeToEdit) {
        return updateEpisode(episodeToEdit.episode_id, payload);
      }
      return createEpisode(seasonId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episodes', seasonId] });
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!episodeId.trim()) {
      setErrorMessage('Episode ID is required.');
      return;
    }
    const num = parseInt(episodeNumber, 10);
    if (isNaN(num) || num < 1) {
      setErrorMessage('Episode number must be an integer 1 or greater.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Title is required.');
      return;
    }
    if (!contentGroup.trim()) {
      setErrorMessage('Content group is required.');
      return;
    }

    const dur = durationSeconds.trim() !== '' ? parseInt(durationSeconds, 10) : null;
    if (status === 'published' && (dur === null || isNaN(dur) || dur < 0)) {
      setErrorMessage('Published episodes must have a valid duration in seconds.');
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">
            {isEditing ? `Edit Episode: ${episodeToEdit?.episode_id}` : 'Create New Episode'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none p-1 transition-colors"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {errorMessage && (
          <div className="m-6 mb-0 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert" data-testid="episode-form-error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="episode-id" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Episode ID <span className="text-rose-400">*</span>
              </label>
              <input
                id="episode-id"
                type="text"
                value={episodeId}
                onChange={(e) => setEpisodeId(e.target.value)}
                placeholder="Enter unique episode ID"
                disabled={mutation.isPending}
                required
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
              <small className="block text-xs text-slate-400">Unique identifier for this episode.</small>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="episode-number" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Episode Number <span className="text-rose-400">*</span>
              </label>
              <input
                id="episode-number"
                type="number"
                min="1"
                step="1"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                placeholder="Enter episode number"
                disabled={mutation.isPending}
                required
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <small className="block text-xs text-slate-400">Episode order (minimum 1).</small>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="episode-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="episode-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter episode title"
              disabled={mutation.isPending}
              required
              className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="episode-content-group" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Content Group <span className="text-rose-400">*</span>
              </label>
              <input
                id="episode-content-group"
                type="text"
                value={contentGroup}
                onChange={(e) => setContentGroup(e.target.value)}
                placeholder="Enter content group identifier"
                disabled={mutation.isPending}
                required
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
              />
              <small className="block text-xs text-slate-400">
                Links language variants together (e.g. English and Hindi).
              </small>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="episode-language" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Language <span className="text-rose-400">*</span>
              </label>
              <select
                id="episode-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageType)}
                disabled={mutation.isPending}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              >
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="episode-status" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status
              </label>
              <select
                id="episode-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as EpisodeStatus)}
                disabled={mutation.isPending}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="episode-duration" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Duration (Seconds) {status === 'published' && <span className="text-rose-400">*</span>}
              </label>
              <input
                id="episode-duration"
                type="number"
                min="0"
                step="1"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
                placeholder="Duration in seconds"
                disabled={mutation.isPending}
                required={status === 'published'}
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <small className="block text-xs text-slate-400">
                {status === 'published'
                  ? 'Required for published status.'
                  : 'Optional for draft status.'}
              </small>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="episode-synopsis" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Synopsis
            </label>
            <textarea
              id="episode-synopsis"
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Enter synopsis"
              disabled={mutation.isPending}
              className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          {/* Artwork Previews Section (when editing) */}
          {isEditing && episodeToEdit && (
            <div className="pt-4 border-t border-slate-800 space-y-3" data-testid="episode-artwork-preview-section">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Episode Artwork
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Poster, Banner, and Thumbnail artwork for catalogue display.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsArtworkModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/20 transition-colors inline-flex items-center gap-1.5"
                  data-testid="edit-modal-manage-artwork-btn"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Manage Artwork
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3" data-testid="edit-modal-artwork-previews">
                {(['poster', 'banner', 'thumbnail'] as const).map((type) => {
                  const art = artworkMap[type];
                  const spec = ARTWORK_SPECS[type];
                  return (
                    <div
                      key={type}
                      className={`bg-slate-950/70 border ${
                        art ? 'border-emerald-500/30' : 'border-slate-800'
                      } rounded-xl p-3 flex flex-col items-center justify-between min-h-[120px] text-center`}
                      data-testid={`edit-artwork-slot-${type}`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-bold text-slate-200">{spec.label}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                            art
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {art ? 'Uploaded' : 'Missing'}
                        </span>
                      </div>
                      {art?.file_path ? (
                        <div className="my-1 flex items-center justify-center">
                          <img
                            src={formatArtworkUrl(art.file_path)}
                            alt={`${spec.label} preview`}
                            className="max-h-[70px] max-w-full object-contain rounded shadow border border-slate-800"
                            data-testid={`edit-artwork-img-${type}`}
                          />
                        </div>
                      ) : (
                        <div className="py-3 text-slate-500 text-xs">
                          <span>{spec.width} &times; {spec.height}</span>
                        </div>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">
                        {spec.aspectRatio}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 min-w-[130px]"
              disabled={mutation.isPending}
              data-testid="save-episode-btn"
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Saving...
                </span>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Episode'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Artwork Management Sub-modal */}
      {isEditing && episodeToEdit && (
        <EpisodeArtworkModal
          isOpen={isArtworkModalOpen}
          onClose={() => {
            setIsArtworkModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['artwork', episodeToEdit.episode_id] });
          }}
          episode={episodeToEdit}
        />
      )}
    </div>
  );
};

