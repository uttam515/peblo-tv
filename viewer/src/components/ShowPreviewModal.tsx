import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CatalogueShow } from '../types/catalog';
import { getShowBanner, getShowPoster } from '../utils/artwork';

interface ShowPreviewModalProps {
  show: CatalogueShow | null;
  onClose: () => void;
}

export const ShowPreviewModal: React.FC<ShowPreviewModalProps> = ({ show, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  const bannerUrl = getShowBanner(show) || getShowPoster(show);
  const description =
    show.description ||
    show.seasons?.[0]?.episodes?.[0]?.synopsis ||
    'Watch all episodes on Peblo TV.';

  const handleWatchShow = () => {
    onClose();
    navigate(`/shows/${show.slug}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      data-testid="show-preview-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-[#131a29] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        data-testid="show-preview-content"
      >
        {/* Banner Area */}
        <div className="relative w-full aspect-video sm:h-72 bg-[#0d131f] overflow-hidden flex-shrink-0">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt={`${show.title} banner`}
              className="w-full h-full object-cover object-center"
              data-testid="preview-banner-image"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0f1b2d] to-[#131a29]">
              <span className="text-xl font-bold text-slate-400">{show.title}</span>
            </div>
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#131a29] via-[#131a29]/40 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#131a29]/60 via-transparent to-transparent pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white flex items-center justify-center border border-white/15 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close preview"
            data-testid="close-preview-btn"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8 -mt-6 relative z-10 flex flex-col gap-4">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] px-2.5 py-1 rounded"
              data-testid="preview-show-section"
            >
              {show.section}
            </span>
            {show.categories?.map((cat) => (
              <span
                key={cat}
                className="bg-white/10 backdrop-blur-sm text-slate-200 text-xs font-medium px-2.5 py-1 rounded border border-white/10"
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Title */}
          <h2
            id="preview-modal-title"
            className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug"
            data-testid="preview-show-title"
          >
            {show.title}
          </h2>

          {/* Short description */}
          <p
            className="text-slate-300 text-sm sm:text-base leading-relaxed line-clamp-4"
            data-testid="preview-show-description"
          >
            {description}
          </p>

          {/* Primary Action Button */}
          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleWatchShow}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-7 py-3 rounded-xl transition-all shadow-lg hover:shadow-blue-600/25 cursor-pointer text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#131a29]"
              data-testid="watch-show-button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
              </svg>
              Watch Show
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer"
              data-testid="preview-cancel-btn"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
