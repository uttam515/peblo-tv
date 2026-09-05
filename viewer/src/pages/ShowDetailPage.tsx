import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCatalog } from '../api/catalog';
import { ApiError } from '../api/client';
import { ShowHero } from '../components/ShowHero';
import { SeasonSection } from '../components/SeasonSection';
import { ShowDetailSkeleton } from '../components/ShowDetailSkeleton';

export const ShowDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['catalog'],
    queryFn: getCatalog,
  });

  const isUnpublished =
    isError && error instanceof ApiError && error.status === 404;

  const show = data?.sections
    ?.flatMap((s) => s.shows)
    ?.find((sh) => sh.slug === slug);

  if (isLoading) {
    return <ShowDetailSkeleton />;
  }

  if (isError) {
    return (
      <div
        className="bg-[#131a29] border border-[#233048] rounded-2xl p-10 text-center flex flex-col items-center gap-4 max-w-lg mx-auto mt-8"
        data-testid="show-detail-error"
      >
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-100">
          {isUnpublished ? 'Catalogue Coming Soon' : 'Unable to Load Show'}
        </h3>
        <p className="text-slate-400 text-sm">
          {isUnpublished
            ? 'No catalogue has been published yet. Please check back later.'
            : error instanceof Error
            ? error.message
            : 'Failed to retrieve catalogue content.'}
        </p>
        <div className="flex gap-3 mt-2">
          {!isUnpublished && (
            <button
              onClick={() => refetch()}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="retry-button"
            >
              Retry
            </button>
          )}
          <Link
            to="/"
            className="bg-[#1e293b] hover:bg-slate-700 text-slate-200 font-semibold text-sm px-4 py-2 rounded-lg transition-colors no-underline inline-flex items-center"
            data-testid="back-to-home"
          >
            Back to Catalogue
          </Link>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div
        className="bg-[#131a29] border border-[#233048] rounded-2xl p-10 text-center flex flex-col items-center gap-4 max-w-lg mx-auto mt-8"
        data-testid="show-not-found"
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-100">Show Not Found</h3>
        <p className="text-slate-400 text-sm">
          Could not find any published show matching slug &quot;{slug}&quot;.
        </p>
        <Link
          to="/"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors no-underline inline-flex items-center mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="back-to-home"
        >
          Return to Catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 md:gap-12" data-testid="viewer-show-detail-page">
      <ShowHero show={show} />
      <SeasonSection seasons={show.seasons || []} />
    </div>
  );
};
