import React from 'react';

export const ShowDetailSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-8 animate-pulse" data-testid="show-detail-skeleton">
      {/* Hero skeleton */}
      <div className="rounded-2xl min-h-[400px] md:min-h-[500px] w-full bg-[#131a29] border border-white/5 p-6 sm:p-10 flex flex-col justify-between">
        {/* Back button placeholder */}
        <div className="w-28 h-8 bg-white/5 rounded-lg" />
        {/* Meta */}
        <div className="flex flex-col gap-4 max-w-2xl">
          <div className="flex gap-2">
            <div className="w-20 h-5 bg-blue-900/30 rounded" />
            <div className="w-16 h-5 bg-white/5 rounded" />
          </div>
          <div className="w-2/3 h-10 bg-white/5 rounded-lg" />
          <div className="w-full max-w-lg h-14 bg-white/[0.03] rounded-lg" />
        </div>
      </div>

      {/* Episodes section skeleton */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-blue-600/30 rounded-full" />
            <div className="w-28 h-6 bg-white/5 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="w-14 h-8 bg-white/5 rounded-lg" />
            <div className="w-14 h-8 bg-white/[0.03] rounded-lg" />
          </div>
        </div>

        {/* Episode card skeletons */}
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#131a29] border border-white/5 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5"
            >
              <div className="w-full sm:w-44 md:w-52 aspect-video bg-white/5 rounded-lg flex-shrink-0" />
              <div className="flex-1 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2.5">
                  <div className="w-1/3 h-5 bg-white/5 rounded" />
                  <div className="w-full h-9 bg-white/[0.03] rounded" />
                </div>
                <div className="w-28 h-6 bg-white/[0.03] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
