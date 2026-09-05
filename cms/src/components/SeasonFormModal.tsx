import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Season } from '../types/season';
import { createSeason, updateSeason } from '../api/seasons';
import { ApiError } from '../api/client';

interface SeasonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  showId: number;
  seasonToEdit: Season | null;
}

export const SeasonFormModal: React.FC<SeasonFormModalProps> = ({
  isOpen,
  onClose,
  showId,
  seasonToEdit,
}) => {
  const queryClient = useQueryClient();

  const [seasonNumber, setSeasonNumber] = useState<string>('1');
  const [title, setTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = Boolean(seasonToEdit);

  useEffect(() => {
    if (seasonToEdit) {
      setSeasonNumber(String(seasonToEdit.season_number));
      setTitle(seasonToEdit.title || '');
    } else {
      setSeasonNumber('1');
      setTitle('');
    }
    setErrorMessage(null);
  }, [seasonToEdit, isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      const num = parseInt(seasonNumber, 10);
      if (isNaN(num) || num < 0) {
        throw new Error('Season number must be a valid integer greater than or equal to 0.');
      }

      const payload = {
        season_number: num,
        title: title.trim() || null,
      };

      if (isEditing && seasonToEdit) {
        return updateSeason(seasonToEdit.id, payload);
      }
      return createSeason(showId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons', showId] });
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

    const num = parseInt(seasonNumber, 10);
    if (isNaN(num) || num < 0) {
      setErrorMessage('Please enter a valid season number (0 or greater).');
      return;
    }

    mutation.mutate();
  };

  const isSeasonZero = parseInt(seasonNumber, 10) === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">
            {isEditing ? `Edit Season ${seasonToEdit?.season_number}` : 'Create New Season'}
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
          <div className="m-6 mb-0 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert" data-testid="season-form-error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label htmlFor="season-number" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Season Number <span className="text-rose-400">*</span>
            </label>
            <input
              id="season-number"
              type="number"
              min="0"
              step="1"
              value={seasonNumber}
              onChange={(e) => setSeasonNumber(e.target.value)}
              placeholder="Enter season number (0 for Trailers)"
              disabled={mutation.isPending}
              required
              className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <small className="block text-xs text-slate-400">
              {isSeasonZero ? (
                <span className="text-amber-400 font-medium">Season number 0 is designated for Trailers.</span>
              ) : (
                'Use 0 for Trailers, 1+ for regular seasons.'
              )}
            </small>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="season-title" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Title
            </label>
            <input
              id="season-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter season title"
              disabled={mutation.isPending}
              className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

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
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 min-w-[120px]"
              disabled={mutation.isPending}
              data-testid="save-season-btn"
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Saving...
                </span>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Season'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
