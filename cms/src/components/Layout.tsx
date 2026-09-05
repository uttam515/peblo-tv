import React from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getCatalogStatus } from '../api/publish';
import { DashboardIcon, ShowsIcon, PublishIcon, TvIcon } from './icons';
import { ErrorBoundary } from './ErrorBoundary';

export const Layout: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const { data: statusData } = useQuery({
    queryKey: ['catalogStatus'],
    queryFn: getCatalogStatus,
    refetchInterval: 15000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const status = statusData?.status || 'no_catalogue';

  return (
    <div className="flex h-screen bg-[#0f172a] text-[#f8fafc] overflow-hidden">
      {/* Sidebar with independent scroll */}
      <aside className="w-[260px] bg-[#1e293b] border-r border-[#334155] flex flex-col justify-between p-5 flex-shrink-0 h-screen overflow-y-auto">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5 px-2 text-indigo-400">
            <TvIcon className="w-6 h-6 text-indigo-400 flex-shrink-0" />
            <h2 className="text-xl font-bold text-[#f8fafc] tracking-tight">Peblo CMS</h2>
          </div>

          <nav className="flex flex-col gap-1.5">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all no-underline ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:bg-[#334155] hover:text-white'
                }`
              }
            >
              <DashboardIcon className="w-4 h-4 flex-shrink-0" />
              Dashboard
            </NavLink>
            <NavLink
              to="/shows"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all no-underline ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:bg-[#334155] hover:text-white'
                }`
              }
            >
              <ShowsIcon className="w-4 h-4 flex-shrink-0" />
              Shows
            </NavLink>
            <NavLink
              to="/publish"
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all no-underline ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:bg-[#334155] hover:text-white'
                }`
              }
            >
              <PublishIcon className="w-4 h-4 flex-shrink-0" />
              Publish Catalogue
            </NavLink>
          </nav>
        </div>

        <div className="flex flex-col gap-4 pt-4 border-t border-[#334155]">
          {/* Global Catalogue Status Indicator */}
          <div
            className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2"
            data-testid="global-catalogue-status"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Viewer
              </span>
              {status === 'live' && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400"
                  data-testid="global-status-live"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Live
                </span>
              )}
              {status === 'changes_pending' && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-400"
                  data-testid="global-status-pending"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Update Pending
                </span>
              )}
              {status === 'no_catalogue' && (
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400"
                  data-testid="global-status-none"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Not Deployed
                </span>
              )}
            </div>

            {isAdmin && status !== 'live' ? (
              <Link
                to="/publish"
                className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors text-center"
                data-testid="global-publish-action-btn"
              >
                Deploy to Viewer &rarr;
              </Link>
            ) : !isAdmin && status !== 'live' ? (
              <Link
                to="/publish"
                className="w-full py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 transition-colors text-center"
                data-testid="global-editor-status-link"
              >
                Review Status &rarr;
              </Link>
            ) : null}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow flex-shrink-0">
              {user?.username ? user.username[0].toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col overflow-hidden flex-1 min-w-0">
              <span className="text-sm font-semibold text-[#f8fafc] truncate" data-testid="current-username">
                {user?.username}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider w-fit ${
                  user?.role === 'admin' ? 'bg-purple-600 text-white' : 'bg-sky-500 text-white'
                }`}
                data-testid="current-role"
              >
                {user?.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 bg-transparent border border-[#334155] hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-400 text-slate-400 rounded-xl text-xs font-medium transition-all cursor-pointer"
            data-testid="logout-btn"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main content with independent scroll and footer */}
      <main className="flex-1 bg-[#0f172a] p-8 h-screen overflow-y-auto flex flex-col justify-between">
        <div className="flex-1">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
        <footer className="mt-12 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
          Made with ❤️ in India
        </footer>
      </main>
    </div>
  );
};
