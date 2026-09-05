import React from 'react';
import { Link } from 'react-router-dom';
import { CatalogueShow } from '../types/catalog';
import { getShowBanner } from '../utils/artwork';

interface HeroProps {
  show: CatalogueShow;
}

export const Hero: React.FC<HeroProps> = ({ show }) => {
  const bannerUrl = getShowBanner(show);
  const description =
    show.description ||
    show.seasons?.[0]?.episodes?.[0]?.synopsis ||
    'Watch this exciting animated series on Peblo TV.';

  return (
    <section
      className="relative rounded-2xl overflow-hidden min-h-[440px] md:min-h-[520px] flex items-end border border-white/5 bg-[#131a29]"
      data-testid="hero-section"
    >
      {/* Background banner */}
      {bannerUrl && (
        <img
          src={bannerUrl}
          alt={`${show.title} banner artwork`}
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          data-testid="hero-banner-image"
        />
      )}

      {/* Layered gradients for cinematic depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-[#090d16]/70 to-[#090d16]/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090d16] via-[#090d16]/55 to-transparent pointer-events-none" />
      {/* Subtle vignette around edges */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_#090d16]" />

      {/* Hero content */}
      <div className="relative z-10 max-w-2xl flex flex-col gap-4 p-6 sm:p-10 md:p-12 pb-10 sm:pb-12">
        {/* Section + category badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px] px-2.5 py-1 rounded">
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
          className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-lg"
          data-testid="hero-title"
        >
          {show.title}
        </h1>

        {/* Description */}
        <p
          className="text-slate-300 text-sm sm:text-base leading-relaxed line-clamp-3 max-w-lg"
          data-testid="hero-description"
        >
          {description}
        </p>

        {/* CTA */}
        <div className="pt-1 flex items-center gap-3">
          <Link
            to={`/shows/${show.slug}`}
            className="inline-flex items-center gap-2.5 bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 px-7 rounded-lg transition-all shadow-xl no-underline text-sm sm:text-base hover:scale-[1.02] active:scale-[0.98]"
            data-testid="hero-view-show"
          >
            {/* Play icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
            </svg>
            View Show
          </Link>
          <Link
            to={`/shows/${show.slug}`}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold py-3 px-6 rounded-lg transition-all border border-white/15 no-underline text-sm sm:text-base"
          >
            More Info
          </Link>
        </div>
      </div>
    </section>
  );
};
