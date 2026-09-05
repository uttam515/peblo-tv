import React from 'react';
import { CatalogueEpisode } from '../types/catalog';
import { formatDuration } from '../utils/format';
import { formatArtworkUrl } from '../utils/artwork';

interface EpisodeCardProps {
  episode: CatalogueEpisode;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({ episode }) => {
  const rawThumb =
    episode.artwork?.thumbnail ||
    episode.artwork?.banner ||
    episode.artwork?.poster;
  const thumbnailUrl = formatArtworkUrl(rawThumb);

  return (
    <article
      className="group bg-[#131a29] border border-white/5 hover:border-white/15 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 transition-all duration-200 hover:bg-[#182235] hover:shadow-lg"
      data-testid={`episode-card-${episode.episode_number}`}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-full sm:w-44 md:w-52 aspect-video rounded-lg overflow-hidden bg-[#1e293b] border border-white/5">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${episode.title} thumbnail`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            data-testid={`episode-thumbnail-${episode.episode_number}`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#131a29] to-[#1e293b]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-7 h-7 text-slate-600 mb-1"
              aria-hidden="true"
            >
              <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
            </svg>
            <span className="text-xs text-slate-500">Preview</span>
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-slate-200 text-[11px] font-mono font-medium px-1.5 py-0.5 rounded">
          {formatDuration(episode.duration_seconds)}
        </div>
      </div>

      {/* Episode Details */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        {/* Episode number + title */}
        <div className="flex items-start gap-2.5 flex-wrap">
          <span className="text-blue-400 font-bold text-sm flex-shrink-0 mt-0.5">
            E{episode.episode_number}
          </span>
          <h4
            className="text-sm sm:text-base font-bold text-slate-100 leading-snug"
            data-testid={`episode-title-${episode.episode_number}`}
          >
            {episode.title}
          </h4>
        </div>

        {/* Synopsis */}
        {episode.synopsis && (
          <p
            className="text-slate-400 text-xs sm:text-sm leading-relaxed line-clamp-2"
            data-testid={`episode-synopsis-${episode.episode_number}`}
          >
            {episode.synopsis}
          </p>
        )}
      </div>
    </article>
  );
};
