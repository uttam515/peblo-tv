import React from 'react';

export const HomeSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-10 animate-pulse" data-testid="viewer-skeleton">
      {/* Hero Skeleton */}
      <div className="rounded-2xl min-h-[440px] md:min-h-[520px] w-full bg-[#131a29] border border-white/5 p-6 sm:p-10 md:p-12 flex flex-col justify-end gap-4">
        <div className="w-20 h-5 bg-white/5 rounded-full" />
        <div className="w-2/3 md:w-1/2 h-12 bg-white/5 rounded-lg" />
        <div className="w-full max-w-lg h-12 bg-white/[0.03] rounded-lg" />
        <div className="flex gap-3 pt-1">
          <div className="w-32 h-12 bg-white/5 rounded-lg" />
          <div className="w-28 h-12 bg-white/[0.03] rounded-lg" />
        </div>
      </div>

      {/* Row skeletons */}
      {[1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-4">
          {/* Row heading */}
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-blue-600/30 rounded-full" />
            <div className="w-28 h-6 bg-white/5 rounded" />
          </div>
          {/* Card strip */}
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-none w-36 sm:w-44 md:w-48 flex flex-col gap-2.5">
                <div className="aspect-[2/3] w-full bg-[#131a29] border border-white/5 rounded-lg" />
                <div className="w-3/4 h-3.5 bg-white/5 rounded" />
                <div className="w-1/2 h-3 bg-white/[0.03] rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
