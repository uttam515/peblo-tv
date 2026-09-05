import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

export const SearchBar: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const urlQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(urlQuery);
  const isFirstMount = useRef(true);

  // Sync local state when URL changes externally
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  // Debounce push to URL
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const trimmed = query.trim();
      const currentQ = searchParams.get('q') || '';
      if (trimmed === currentQ) return;

      const nextParams = new URLSearchParams(searchParams);
      if (trimmed) {
        nextParams.set('q', trimmed);
      } else {
        nextParams.delete('q');
      }

      if (location.pathname !== '/') {
        navigate({ pathname: '/', search: nextParams.toString() });
      } else {
        setSearchParams(nextParams, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchParams, setSearchParams, navigate, location.pathname]);

  const handleClear = () => {
    setQuery('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('q');
    if (location.pathname !== '/') {
      navigate({ pathname: '/', search: nextParams.toString() });
    } else {
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <div
      className="relative flex items-center w-full"
      data-testid="search-bar-container"
    >
      {/* Search icon */}
      <div className="absolute left-3 pointer-events-none text-slate-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <input
        type="search"
        role="searchbox"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search shows, episodes..."
        aria-label="Search shows, episodes, or categories"
        className="w-full bg-[#1a2540]/80 border border-white/10 focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/50 rounded-full pl-9 pr-8 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
        data-testid="header-search-input"
      />

      {query && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 text-slate-500 hover:text-slate-200 transition-colors"
          data-testid="clear-search-btn"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3.5 h-3.5"
            aria-hidden="true"
          >
            <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
          </svg>
        </button>
      )}
    </div>
  );
};
