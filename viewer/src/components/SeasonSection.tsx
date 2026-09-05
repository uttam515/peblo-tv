import React, { useMemo, useState } from 'react';
import { CatalogueSeason } from '../types/catalog';
import { EpisodeCard } from './EpisodeCard';
import { formatSeasonLabel } from '../utils/format';

interface SeasonSectionProps {
  seasons: CatalogueSeason[];
}

export const SeasonSection: React.FC<SeasonSectionProps> = ({ seasons }) => {
  // Filter out Season 0 (trailers) and sort ascending by season_number
  const normalSeasons = useMemo(() => {
    return seasons
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number);
  }, [seasons]);

  const [activeSeasonNumber, setActiveSeasonNumber] = useState<number>(
    normalSeasons[0]?.season_number || 1
  );

  // Compute default language across all episodes in this show
  const allEpisodes = useMemo(() => {
    return seasons.flatMap((s) => s.episodes || []);
  }, [seasons]);

  const hasEnglish = useMemo(() => {
    return allEpisodes.some((ep) =>
      ep.languages?.some((l) => l.toLowerCase() === 'en' || l.toLowerCase() === 'english')
    );
  }, [allEpisodes]);

  const hasHindi = useMemo(() => {
    return allEpisodes.some((ep) =>
      ep.languages?.some((l) => l.toLowerCase() === 'hi' || l.toLowerCase() === 'hindi')
    );
  }, [allEpisodes]);

  // Default to English when available; if no English but Hindi available, default to Hindi
  const initialLanguage = hasEnglish ? 'en' : hasHindi ? 'hi' : 'en';
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi'>(initialLanguage);

  if (normalSeasons.length === 0) {
    return (
      <div
        className="bg-[#131a29] border border-white/5 rounded-2xl p-10 text-center"
        data-testid="no-regular-seasons"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-10 h-10 text-slate-600 mx-auto mb-3"
          aria-hidden="true"
        >
          <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
        </svg>
        <h3 className="text-lg font-bold text-slate-100 mb-1">
          No Full Episodes Released Yet
        </h3>
        <p className="text-slate-400 text-sm">
          This title currently only has promotional trailers and previews.
        </p>
      </div>
    );
  }

  const activeSeason =
    normalSeasons.find((s) => s.season_number === activeSeasonNumber) ||
    normalSeasons[0];

  const seasonLabel = formatSeasonLabel(activeSeason.season_number);

  // Check if activeSeason has a custom title that is not duplicated
  const rawTitle = activeSeason.title?.trim();
  const normalizedTitle = rawTitle ? rawTitle.toLowerCase() : '';
  const normalizedLabel = seasonLabel.toLowerCase();
  const hasDistinctTitle =
    Boolean(rawTitle) &&
    normalizedTitle !== normalizedLabel &&
    normalizedTitle !== 'trailers' &&
    normalizedTitle !== 'season 0' &&
    !normalizedTitle.startsWith(`season ${activeSeason.season_number} -`) &&
    !normalizedTitle.startsWith(`season ${activeSeason.season_number}:`);

  // Filter episodes by selected language
  const filteredEpisodes = (activeSeason?.episodes || [])
    .filter((ep) =>
      ep.languages?.some((l) => {
        const langLower = l.toLowerCase();
        return (
          langLower === selectedLanguage ||
          (selectedLanguage === 'en' && langLower === 'english') ||
          (selectedLanguage === 'hi' && langLower === 'hindi')
        );
      })
    )
    .sort((a, b) => a.episode_number - b.episode_number);

  return (
    <section className="flex flex-col gap-6" data-testid="seasons-container">
      {/* Episodes header + Controls (Language dropdown & Season tabs) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div className="flex items-center gap-3">
          <span className="block w-1 h-5 rounded-full bg-blue-500 flex-shrink-0" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            Episodes
          </h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Language selector dropdown */}
          <div className="flex items-center gap-2" data-testid="show-detail-language-container">
            <label htmlFor="show-detail-language-select" className="text-xs text-slate-400 font-medium">
              Language:
            </label>
            <div className="relative">
              <select
                id="show-detail-language-select"
                aria-label="Filter episodes by language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as 'en' | 'hi')}
                className="bg-[#182235] hover:bg-[#1e2c45] border border-white/10 text-slate-200 text-xs sm:text-sm font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
                data-testid="show-detail-language-select"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              <svg
                className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Season tabs */}
          {normalSeasons.length > 1 && (
            <div
              className="flex items-center gap-1"
              role="tablist"
              aria-label="Select Season"
              data-testid="season-tabs"
            >
              {normalSeasons.map((s) => {
                const isActive = s.season_number === activeSeasonNumber;
                return (
                  <button
                    key={s.season_number}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveSeasonNumber(s.season_number)}
                    className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded-lg ${
                      isActive
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                    data-testid={`season-tab-${s.season_number}`}
                  >
                    {formatSeasonLabel(s.season_number)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Season meta (clean label and optional distinct title/description) */}
      <div className="bg-[#131a29]/60 border border-white/5 rounded-xl px-4 py-3 flex flex-col gap-0.5">
        <h3 className="font-bold text-sm text-slate-200" data-testid="active-season-heading">
          {hasDistinctTitle ? `${seasonLabel}: ${activeSeason.title}` : seasonLabel}
        </h3>
        {activeSeason.description && (
          <p className="text-slate-400 text-xs leading-relaxed">{activeSeason.description}</p>
        )}
      </div>

      {/* Episode cards or empty state */}
      {filteredEpisodes.length === 0 ? (
        <div
          className="bg-[#131a29] border border-white/5 rounded-xl p-8 text-center"
          data-testid="no-episodes-message"
        >
          <p className="text-slate-400 text-sm">
            No {selectedLanguage === 'hi' ? 'Hindi' : 'English'} episodes found in {seasonLabel}.
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col gap-3"
          data-testid={`season-${activeSeason.season_number}-episodes`}
        >
          {filteredEpisodes.map((ep) => (
            <EpisodeCard key={`${ep.content_group}-${ep.episode_number}`} episode={ep} />
          ))}
        </div>
      )}
    </section>
  );
};
