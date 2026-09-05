import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CatalogueSection, CatalogueShow } from '../types/catalog';
import { ShowRow } from './ShowRow';
import { ShowCard } from './ShowCard';

interface SearchResultsProps {
  sections: CatalogueSection[];
  totalShows: number;
  onSelectShow?: (show: CatalogueShow) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  sections,
  totalShows,
  onSelectShow,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const section = searchParams.get('section') || '';
  const category = searchParams.get('category') || '';
  const language = searchParams.get('language') || '';

  const handleClearAll = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // No shows found
  if (totalShows === 0) {
    return (
      <div
        className="py-12 flex justify-center"
        data-testid="search-empty-state"
        role="status"
      >
        <div className="bg-[#131a29] border border-white/5 rounded-2xl p-8 sm:p-12 max-w-xl w-full text-center flex flex-col items-center gap-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-12 h-12 text-slate-600 mx-auto"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-2xl font-bold text-slate-100">No Shows Found</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            We couldn&apos;t find any shows matching your search or filters.
          </p>
          {/* Active filter tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
            {query && (
              <span className="bg-[#1a2540] px-3 py-1 rounded-full border border-white/10">
                &ldquo;{query}&rdquo;
              </span>
            )}
            {section && (
              <span className="bg-[#1a2540] px-3 py-1 rounded-full border border-white/10">
                {section}
              </span>
            )}
            {category && (
              <span className="bg-[#1a2540] px-3 py-1 rounded-full border border-white/10">
                {category}
              </span>
            )}
            {language && (
              <span className="bg-[#1a2540] px-3 py-1 rounded-full border border-white/10">
                {language.toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={handleClearAll}
            className="mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors shadow cursor-pointer"
            data-testid="clear-search-filters-btn"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    );
  }

  const nonEmptySections = sections.filter(
    (sec) => sec.shows && sec.shows.length > 0
  );

  return (
    <div className="flex flex-col gap-8" data-testid="search-results-container">
      {/* Summary header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            {query ? `Results for "${query}"` : 'Filtered Results'}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {totalShows} show{totalShows > 1 ? 's' : ''} across{' '}
            {nonEmptySections.length} section
            {nonEmptySections.length > 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={handleClearAll}
          className="text-xs text-slate-400 hover:text-white font-medium px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all cursor-pointer"
          data-testid="clear-all-results-btn"
        >
          Clear All
        </button>
      </div>

      {/* Grid for single-section many-results, else section rows */}
      {nonEmptySections.length === 1 && nonEmptySections[0].shows.length > 4 ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5"
          data-testid="search-results-grid"
        >
          {nonEmptySections[0].shows.map((show) => (
            <ShowCard key={show.id} show={show} onSelect={onSelectShow} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-10" data-testid="search-results-sections">
          {nonEmptySections.map((sec) => (
            <ShowRow key={sec.name} title={sec.name} shows={sec.shows} onSelectShow={onSelectShow} />
          ))}
        </div>
      )}
    </div>
  );
};
