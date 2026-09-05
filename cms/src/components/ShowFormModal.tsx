import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Show, SectionType, StatusType } from '../types/show';
import { createShow, updateShow } from '../api/shows';
import { ApiError } from '../api/client';

interface ShowFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToEdit: Show | null;
}

export const ShowFormModal: React.FC<ShowFormModalProps> = ({
  isOpen,
  onClose,
  showToEdit,
}) => {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [section, setSection] = useState<SectionType | ''>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<StatusType>('draft');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = Boolean(showToEdit);

  useEffect(() => {
    if (showToEdit) {
      setTitle(showToEdit.title || '');
      setSlug(showToEdit.slug || '');
      setSection(showToEdit.section || '');
      setDescription(showToEdit.description || '');
      setStatus(showToEdit.status || 'draft');
    } else {
      setTitle('');
      setSlug('');
      setSection('');
      setDescription('');
      setStatus('draft');
    }
    setErrorMessage(null);
  }, [showToEdit, isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEditing && showToEdit) {
        return updateShow(showToEdit.id, {
          title: title.trim(),
          slug: slug.trim(),
          section: section ? (section as SectionType) : null,
          description: description.trim() || null,
          status,
        });
      }
      return createShow({
        title: title.trim(),
        slug: slug.trim(),
        section: section ? (section as SectionType) : null,
        description: description.trim() || null,
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shows'] });
      if (showToEdit?.id) {
        queryClient.invalidateQueries({ queryKey: ['show', showToEdit.id] });
        queryClient.invalidateQueries({ queryKey: ['seasons', showToEdit.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['catalogStatus'] });
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

    if (!title.trim()) {
      setErrorMessage('Title is required.');
      return;
    }
    if (!slug.trim()) {
      setErrorMessage('Slug is required.');
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-[#f8fafc]">{isEditing ? 'Edit Show' : 'Create New Show'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none cursor-pointer" aria-label="Close modal">
            &times;
          </button>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm" role="alert" data-testid="show-form-error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="show-title" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="show-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter show title"
              disabled={mutation.isPending}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="show-slug" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Slug <span className="text-red-400">*</span>
            </label>
            <input
              id="show-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="Enter show slug (e.g. show-name)"
              disabled={mutation.isPending}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="show-section" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Section
            </label>
            <select
              id="show-section"
              value={section}
              onChange={(e) => setSection(e.target.value as SectionType | '')}
              disabled={mutation.isPending}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="">None (Unassigned)</option>
              <option value="featured">Featured</option>
              <option value="series">Series</option>
              <option value="minisodes">Minisodes</option>
              <option value="songs">Songs</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="show-status" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Status
            </label>
            <select
              id="show-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusType)}
              disabled={mutation.isPending}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="show-description" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Description
            </label>
            <textarea
              id="show-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter synopsis"
              disabled={mutation.isPending}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500 resize-y"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#334155] hover:bg-slate-600 text-slate-200 font-semibold rounded-lg text-sm transition-colors cursor-pointer"
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer shadow-sm flex items-center gap-2"
              disabled={mutation.isPending}
              data-testid="save-show-btn"
            >
              {mutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Show'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
