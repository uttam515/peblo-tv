import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { SearchBar } from './SearchBar';

export const Header: React.FC = () => {
  return (
    <header
      className="sticky top-0 z-50 bg-[#090d16]/95 backdrop-blur-md border-b border-white/5 px-4 sm:px-8 py-3"
      data-testid="viewer-header"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        {/* Brand wordmark */}
        <Link
          to="/"
          className="flex items-center gap-1.5 no-underline flex-shrink-0 select-none"
          data-testid="brand-link"
          aria-label="Peblo TV – Home"
        >
          {/* Visually-hidden text for accessibility and tests */}
          <span className="sr-only">Peblo TV</span>
          {/* "PEBLO" block in white */}
          <span className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none" aria-hidden="true">
            PEBLO
          </span>
          {/* "TV" pill accent */}
          <span className="hidden sm:inline-flex items-center justify-center bg-blue-600 text-white text-[10px] font-black tracking-widest rounded px-1.5 py-0.5 leading-none" aria-hidden="true">
            TV
          </span>
        </Link>

        {/* Search Bar – centred, grows */}
        <div className="flex-1 max-w-md mx-auto">
          <SearchBar />
        </div>

        {/* Nav */}
        <nav
          className="flex items-center gap-5 flex-shrink-0"
          data-testid="viewer-nav"
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive
                ? 'text-white font-semibold text-sm no-underline transition-colors'
                : 'text-slate-400 hover:text-white font-semibold text-sm no-underline transition-colors'
            }
          >
            Home
          </NavLink>
        </nav>
      </div>
    </header>
  );
};
