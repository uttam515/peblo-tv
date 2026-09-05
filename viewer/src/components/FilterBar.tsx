import React from 'react';
import { useSearchParams } from 'react-router-dom';

interface FilterBarProps {
  availableCategories?: string[];
}

const SECTIONS = [
  { value: '', label: 'All' },
  { value: 'featured', label: 'Featured' },
  { value: 'series', label: 'Series' },
  { value: 'minisodes', label: 'Minisodes' },
  { value: 'songs', label: 'Songs' },
];

const LANGUAGES = [
  { value: '', label: 'All Languages' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'hi', label: '🇮🇳 Hindi' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  availableCategories = [],
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedSection = searchParams.get('section') || '';
  const selectedCategory = searchParams.get('category') || '';
  const selectedLanguage = searchParams.get('language') || '';
  const currentQuery = searchParams.get('q') || '';

  const hasActiveFilters = Boolean(
    selectedSection || selectedCategory || selectedLanguage || currentQuery
  );

  const handleFilterChange = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 py-1"
      data-testid="filter-bar"
      role="group"
      aria-label="Filter catalogue"
    >
      {/* Section filter – pill buttons (visual) + hidden select (for tests/a11y) */}
      <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Section filter">
        {SECTIONS.map((sec) => {
          const isActive = selectedSection === sec.value;
          return (
            <button
              key={sec.value}
              type="button"
              onClick={() => handleFilterChange('section', sec.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                isActive
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-[#1a2540] text-slate-300 hover:bg-[#233058] hover:text-white border border-white/10'
              }`}
              aria-pressed={isActive}
              data-testid={`section-pill-${sec.value || 'all'}`}
            >
              {sec.label}
            </button>
          );
        })}
      </div>

      {/*
        Hidden accessible select kept for programmatic control (tests use fireEvent.change).
        Visually hidden but functionally present.
      */}
      <select
        id="section-filter"
        aria-label="Filter by Section"
        value={selectedSection}
        onChange={(e) => handleFilterChange('section', e.target.value)}
        className="sr-only"
        data-testid="filter-section-select"
      >
        {SECTIONS.map((sec) => (
          <option key={sec.value} value={sec.value}>
            {sec.label}
          </option>
        ))}
      </select>

      {/* Divider */}
      <div className="w-px h-5 bg-white/10 hidden sm:block" aria-hidden="true" />

      {/* Category select */}
      {availableCategories.length > 0 && (
        <select
          id="category-filter"
          aria-label="Filter by Category"
          value={selectedCategory}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="bg-[#1a2540] border border-white/10 text-slate-300 text-xs rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-white/20 transition-colors"
          data-testid="filter-category-select"
        >
          <option value="">All Categories</option>
          {availableCategories.map((cat) => (
            <option key={cat} value={cat.toLowerCase()}>
              {cat}
            </option>
          ))}
        </select>
      )}

      {/* Language select */}
      <select
        id="language-filter"
        aria-label="Filter by Language"
        value={selectedLanguage}
        onChange={(e) => handleFilterChange('language', e.target.value)}
        className="bg-[#1a2540] border border-white/10 text-slate-300 text-xs rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-white/20 transition-colors"
        data-testid="filter-language-select"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>

      {/* Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleResetFilters}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer"
          data-testid="reset-filters-btn"
          aria-label="Clear all filters"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3 h-3"
            aria-hidden="true"
          >
            <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
          </svg>
          Reset
        </button>
      )}
    </div>
  );
};
