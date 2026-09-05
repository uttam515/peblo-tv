import React from 'react';
import { CatalogueShow } from '../types/catalog';
import { ShowCard } from './ShowCard';

interface ShowRowProps {
  title: string;
  shows: CatalogueShow[];
  onSelectShow?: (show: CatalogueShow) => void;
}

export const ShowRow: React.FC<ShowRowProps> = ({ title, shows, onSelectShow }) => {
  if (!shows || shows.length === 0) {
    return null;
  }

  const formattedTitle =
    title.charAt(0).toUpperCase() + title.slice(1);

  return (
    <section
      className="flex flex-col gap-4"
      data-testid={`section-row-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Row heading with accent bar */}
      <div className="flex items-center gap-3">
        <span className="block w-1 h-5 rounded-full bg-blue-500 flex-shrink-0" aria-hidden="true" />
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
          {formattedTitle}
        </h2>
      </div>

      {/* Horizontally-scrollable card strip */}
      <div
        className="show-row-scroll flex gap-4 overflow-x-auto pb-4 pt-1 -mx-1 px-1 scroll-smooth"
        tabIndex={0}
        aria-label={`${formattedTitle} shows carousel`}
        style={{ scrollbarWidth: 'thin' }}
      >
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} onSelect={onSelectShow} />
        ))}
      </div>
    </section>
  );
};
