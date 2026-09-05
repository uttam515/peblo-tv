import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Show } from '../types/show';
import { deleteShow } from '../api/shows';
import { ApiError } from '../api/client';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToDelete: Show | null;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  showToDelete,
}) => {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!showToDelete) return;
      await deleteShow(showToDelete.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] });
      onClose();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to delete show.');
      }
    },
  });

  if (!isOpen || !showToDelete) return null;

  const handleDelete = () => {
    setErrorMessage(null);
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Confirm Deletion</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none p-1 transition-colors"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {errorMessage && (
          <div className="m-6 mb-0 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium" role="alert" data-testid="delete-error">
            {errorMessage}
          </div>
        )}

        <div className="p-6 space-y-3">
          <p className="text-slate-300 leading-relaxed text-sm">
            Are you sure you want to delete <strong className="text-white font-semibold">{showToDelete.title}</strong> (
            <code className="bg-slate-950 px-2 py-0.5 rounded text-indigo-300 text-xs">{showToDelete.slug}</code>)?
          </p>
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/40 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 min-w-[120px]"
            disabled={mutation.isPending}
            data-testid="confirm-delete-btn"
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Deleting...
              </span>
            ) : (
              'Delete Show'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
