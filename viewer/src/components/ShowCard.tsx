import React from 'react';
import { Link } from 'react-router-dom';
import { CatalogueShow } from '../types/catalog';
import { getShowPoster } from '../utils/artwork';

interface ShowCardProps {
  show: CatalogueShow;
  onSelect?: (show: CatalogueShow) => void;
}

export const ShowCard: React.FC<ShowCardProps> = ({ show, onSelect }) => {
  const posterUrl = getShowPoster(show);

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect) {
      e.preventDefault();
      onSelect(show);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
      e.preventDefault();
      onSelect(show);
    }
  };

  return (
    <Link
      to={`/shows/${show.slug}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group relative flex-none w-36 sm:w-44 md:w-48 flex flex-col no-underline text-inherit focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] rounded-lg outline-none cursor-pointer"
      data-testid={`show-card-${show.slug}`}
      aria-label={`View ${show.title}`}
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-[#131a29] border border-white/5 group-hover:border-white/20 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.25)] transition-all duration-300 will-change-transform group-hover:scale-[1.04]">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`${show.title} poster`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#0f1b2d] via-[#131a29] to-[#1e293b]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-8 h-8 text-slate-600 mb-2"
              aria-hidden="true"
            >
              <path d="M19.5 6h-15v9h15V6z" />
              <path
                fillRule="evenodd"
                d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v11.25C1.5 17.16 2.34 18 3.375 18H9.75v1.5H6A.75.75 0 006 21h12a.75.75 0 000-1.5h-3.75V18h6.375c1.035 0 1.875-.84 1.875-1.875V4.875C22.5 3.839 21.66 3 20.625 3H3.375zm0 13.5h17.25a.375.375 0 00.375-.375V4.875a.375.375 0 00-.375-.375H3.375A.375.375 0 003 4.875v11.25c0 .207.168.375.375.375z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs font-semibold text-slate-400 line-clamp-2 leading-snug">
              {show.title}
            </span>
          </div>
        )}

        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-slate-900 translate-x-0.5"
              aria-hidden="true"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Card Info */}
      <div className="mt-2.5 flex flex-col gap-0.5 px-0.5">
        <h3
          className="font-semibold text-sm text-slate-200 group-hover:text-white line-clamp-1 transition-colors leading-snug"
          data-testid={`show-title-${show.slug}`}
        >
          {show.title}
        </h3>
        <p className="text-xs text-slate-500 line-clamp-1">
          {show.categories?.join(', ') || show.section}
        </p>
      </div>
    </Link>
  );
};
