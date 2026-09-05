import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCatalog, searchCatalog } from '../api/catalog';
import { ApiError } from '../api/client';
import { Hero } from '../components/Hero';
import { ShowRow } from '../components/ShowRow';
import { HomeSkeleton } from '../components/HomeSkeleton';
import { FilterBar } from '../components/FilterBar';
import { SearchResults } from '../components/SearchResults';
import { ShowPreviewModal } from '../components/ShowPreviewModal';
import { CatalogueShow } from '../types/catalog';

export const HomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [previewShow, setPreviewShow] = useState<CatalogueShow | null>(null);

  const q = searchParams.get('q') || '';
  const section = searchParams.get('section') || '';
  const category = searchParams.get('category') || '';
  const language = searchParams.get('language') || '';

  const isSearchActive = Boolean(q || section || category || language);

  // Fetch either filtered search catalogue or full catalogue
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: isSearchActive
      ? ['catalogSearch', { q, section, category, language }]
      : ['catalog'],
    queryFn: () =>
      isSearchActive
        ? searchCatalog({ q, section, category, language })
        : getCatalog(),
  });

  const isUnpublished =
    isError && error instanceof ApiError && error.status === 404;

  const sections = data?.sections || [];
  const allShows = useMemo(() => {
    return sections.flatMap((s) => s.shows || []);
  }, [sections]);

  // Extract unique categories across all available shows
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const sec of sections) {
      for (const sh of sec.shows || []) {
        for (const c of sh.categories || []) {
          cats.add(c);
        }
      }
    }
    return Array.from(cats).sort();
  }, [sections]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 py-2" data-testid="viewer-home-page">
        <FilterBar availableCategories={availableCategories} />
        <HomeSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6 py-2" data-testid="viewer-home-page">
        <FilterBar availableCategories={availableCategories} />
        <div className="py-12 flex justify-center">
          <div
            className="bg-[#131a29] border border-[#233048] rounded-2xl p-8 sm:p-12 max-w-xl w-full text-center flex flex-col items-center gap-4"
            data-testid="viewer-error"
            role="alert"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-100">
              {isUnpublished ? 'Catalogue Coming Soon' : 'Unable to Load Catalogue'}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {isUnpublished
                ? 'No content has been published to the live catalogue yet. Please check back later.'
                : error instanceof Error
                ? error.message
                : 'An unexpected error occurred while fetching catalogue content.'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors shadow cursor-pointer"
              data-testid="viewer-retry-btn"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active search or filter mode
  if (isSearchActive) {
    return (
      <div className="flex flex-col gap-6 py-2" data-testid="viewer-home-page">
        <FilterBar availableCategories={availableCategories} />
        <SearchResults
          sections={sections}
          totalShows={allShows.length}
          onSelectShow={setPreviewShow}
        />
        <ShowPreviewModal
          show={previewShow}
          onClose={() => setPreviewShow(null)}
        />
      </div>
    );
  }

  // Empty catalogue (no active search)
  if (allShows.length === 0) {
    return (
      <div className="flex flex-col gap-6 py-2" data-testid="viewer-home-page">
        <FilterBar availableCategories={availableCategories} />
        <div className="py-12 flex justify-center">
          <div
            className="bg-[#131a29] border border-[#233048] rounded-2xl p-8 sm:p-12 max-w-xl w-full text-center flex flex-col items-center gap-4"
            data-testid="viewer-empty"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-100">No Shows Available</h3>
            <p className="text-slate-400 text-sm">
              The catalogue is currently empty. Shows will appear here once published.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-6 rounded-lg transition-colors border border-slate-700 cursor-pointer"
              data-testid="viewer-retry-btn"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default Home View (Hero + Section Rows)
  const featuredSection = sections.find(
    (s) => s.name?.toLowerCase() === 'featured'
  );
  const heroShow = featuredSection?.shows?.[0] || allShows[0];

  return (
    <div className="flex flex-col gap-8 py-2" data-testid="viewer-home-page">
      <FilterBar availableCategories={availableCategories} />

      {/* Featured Hero Banner */}
      {heroShow && <Hero show={heroShow} />}

      {/* Catalogue Section Rows */}
      <div className="flex flex-col gap-10" data-testid="catalogue-sections-list">
        {sections.map((sec) => (
          <ShowRow
            key={sec.name}
            title={sec.name}
            shows={sec.shows || []}
            onSelectShow={setPreviewShow}
          />
        ))}
      </div>

      {/* Show Preview Modal */}
      <ShowPreviewModal
        show={previewShow}
        onClose={() => setPreviewShow(null)}
      />
    </div>
  );
};
