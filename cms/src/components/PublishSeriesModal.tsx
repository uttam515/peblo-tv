import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Show } from '../types/show';
import { Season } from '../types/season';
import { publishSeries } from '../api/shows';
import { ApiError } from '../api/client';

interface PublishSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  show: Show | null;
  seasons?: Season[] | undefined;
  onSuccess?: () => void;
}

export const PublishSeriesModal: React.FC<PublishSeriesModalProps> = ({
  isOpen,
  onClose,
  show,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!show) return;
      return publishSeries(show.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['show', show?.id] });
      queryClient.invalidateQueries({ queryKey: ['seasons', show?.id] });
      queryClient.invalidateQueries({ queryKey: ['shows'] });
      queryClient.invalidateQueries({ queryKey: ['catalogStatus'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.data?.detail?.message) {
          const errorsList = err.data?.detail?.errors
            ? ` (${err.data.detail.errors.join(', ')})`
            : '';
          setErrorMessage(`${err.data.detail.message}${errorsList}`);
        } else {
          setErrorMessage(err.message);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to publish series.');
      }
    },
  });

  if (!isOpen || !show) return null;

  const handleConfirm = () => {
    setErrorMessage(null);
    mutation.mutate();
  };

  const isShowDraft = show.status === 'draft';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      data-testid="publish-series-modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Publish Show</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none p-1 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div
            className="m-6 mb-0 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium"
            role="alert"
            data-testid="publish-series-error"
          >
            {errorMessage}
          </div>
        )}

        {/* Body content */}
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-extrabold text-white" data-testid="publish-series-title">
              {show.title}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Slug: <span className="text-indigo-300">{show.slug}</span>
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-medium">Show Status:</span>
              <div className="flex items-center gap-2 font-semibold">
                {isShowDraft ? (
                  <>
                    <span className="text-amber-400">Draft</span>
                    <span className="text-slate-500">&rarr;</span>
                    <span className="text-emerald-400">Published</span>
                  </>
                ) : (
                  <span className="text-emerald-400">Already Published</span>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-3 leading-relaxed">
              <p>
                <strong className="text-slate-300">Publish Scope:</strong> Publishes this show only. Draft episodes remain in draft and can be published individually with required artwork and duration validation.
              </p>
            </div>
          </div>

          {/* Architectural Notice */}
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
            <p className="font-semibold text-indigo-200 mb-1">Catalogue Deployment Notice</p>
            <p>
              This action updates the show to published status in the database, but{' '}
              <strong>does not deploy the live catalogue</strong>. An admin must deploy the live
              catalogue separately to make changes available in the Viewer.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/40 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 min-w-[150px]"
            data-testid="confirm-publish-series-btn"
          >
            {mutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Publishing...
              </>
            ) : (
              'Confirm & Publish'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
