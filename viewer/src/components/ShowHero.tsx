import React from 'react';
import { Link } from 'react-router-dom';
import { CatalogueShow } from '../types/catalog';
import { getShowBanner, getShowPoster } from '../utils/artwork';

interface ShowHeroProps {
  show: CatalogueShow;
}

export const ShowHero: React.FC<ShowHeroProps> = ({ show }) => {
  const bannerUrl = getShowBanner(show);
  const posterUrl = getShowPoster(show);

  return (
    <section
      className="relative rounded-2xl overflow-hidden min-h-[400px] md:min-h-[500px] flex flex-col justify-between border border-white/5 bg-[#131a29]"
      data-testid="show-hero-section"
    >
      {/* Background Banner */}
      {bannerUrl && (
        <img
          src={bannerUrl}
          alt={`${show.title} banner`}
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          data-testid="show-banner-image"
        />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/75 to-[#090d16]/30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090d16] via-[#090d16]/65 to-transparent pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_#090d16]" />

      {/* Back navigation */}
      <div className="relative z-10 p-6 sm:p-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-300 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all no-underline"
          data-testid="back-to-home"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-3.5 h-3.5"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Catalogue
        </Link>
      </div>

      {/* Show metadata */}
      <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-end p-6 sm:p-10 md:p-12 pt-4">
        {/* Poster thumbnail – large screens only */}
        {posterUrl && (
          <div className="hidden lg:block w-32 xl:w-40 aspect-[2/3] rounded-xl overflow-hidden border border-white/10 shadow-2xl flex-shrink-0">
            <img
              src={posterUrl}
              alt={`${show.title} poster`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="max-w-2xl flex flex-col gap-3">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] px-2.5 py-1 rounded"
              data-testid="show-section-badge"
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
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight"
            data-testid="show-title"
          >
            {show.title}
          </h1>

          {/* Description */}
          {show.description && (
            <p
              className="text-slate-300 text-sm sm:text-base leading-relaxed line-clamp-3"
              data-testid="show-description"
            >
              {show.description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
