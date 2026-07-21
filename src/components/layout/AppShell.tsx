import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const PAGE_TITLES: Array<[string, string]> = [
  ['/dashboard', 'Dashboard'],
  ['/guard', 'Guard Console'],
  ['/kiosk', 'Kiosk Mode'],
  ['/approvals', 'Approvals'],
  ['/whos-inside', "Who's Inside"],
  ['/gate-passes/new', 'New Gate Pass'],
  ['/gate-passes', 'Gate Passes'],
  ['/reports', 'Reports'],
  ['/analytics', 'Analytics'],
  ['/admin/activity', 'Activity Log'],
  ['/admin', 'Admin Panel'],
];

function pageTitleFor(pathname: string): string {
  const match = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : 'SecureGate';
}

export default function AppShell({ session, role, children }: Props): React.ReactElement {
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-surface-50 relative">
      <AuroraBackground />

      <Sidebar session={session} role={role} collapsed={collapsed} onCollapsedChange={setCollapsed} />

      <div className={`relative z-10 flex flex-col min-h-screen transition-[padding] duration-300 ease-in-out ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[264px]'}`}>
        {/* Topbar */}
        <header className="no-print sticky top-0 z-30 card-glass !rounded-none !border-x-0 !border-t-0">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-6 lg:px-8 pl-16 lg:pl-8">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg font-bold text-navy-950 tracking-tight truncate">
                {pageTitleFor(loc.pathname)}
              </h1>
              <p className="text-[11px] text-navy-400 hidden sm:block leading-tight">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
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
