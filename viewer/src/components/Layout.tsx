import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export const Layout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#090d16] text-slate-100">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-white/5 px-8 py-6 text-center space-y-2">
        <p className="text-xs text-slate-500 font-medium">
          Made with ❤️ in India
        </p>
        <p className="text-[11px] text-slate-600 tracking-wide">
          © 2026 <span className="font-bold text-slate-500">PEBLO TV</span>. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
