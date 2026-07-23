import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '../../types/index';
import Sidebar from './Sidebar';
import AuroraBackground from '../AuroraBackground';
import NotificationBell from '../NotificationBell';

type Props = {
  session: Session;
  role: UserRole | null;
  children: React.ReactNode;
};

const COLLAPSE_KEY = 'securegate-sidebar-collapsed';

export default function AppShell({ session, role, children }: Props): React.ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/visitors?search=${encodeURIComponent(q)}`);
  };

  const handleScanner = () => {
    navigate('/guard?scanner=1');
  };

  return (
    <div className="min-h-screen bg-surface-50 relative">
      <AuroraBackground />

      <Sidebar session={session} role={role} collapsed={collapsed} onCollapsedChange={setCollapsed} />

      <div className={`relative z-10 flex flex-col min-h-screen transition-[padding] duration-300 ease-in-out ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[264px]'}`}>
        {/* Top strip — search, scanner, notifications */}
        <header className="no-print sticky top-0 z-30 card-glass !rounded-none !border-x-0 !border-t-0">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-6 lg:px-8 pl-16 lg:pl-8">
            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 min-w-0 max-w-md">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search visitors, passes..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-surface-100 border border-surface-200 text-sm text-navy-700 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
                />
              </div>
            </form>

            {/* Scanner action */}
            <button
              onClick={handleScanner}
              className="relative p-2 rounded-xl hover:bg-surface-100 transition-all duration-200"
              title="Scan QR code"
            >
              <svg className="w-5 h-5 text-navy-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
            </button>

            <NotificationBell userId={session.user.id} role={role} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="no-print px-8 pb-6">
          <p className="text-center text-[11px] text-navy-300 tracking-wide">
            SecureGate — Visitor &amp; Material Gate Pass Management System
          </p>
        </footer>
      </div>
    </div>
  );
}
