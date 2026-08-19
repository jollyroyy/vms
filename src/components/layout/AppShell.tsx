import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '../../types/index';
import { supabase } from '../../supabaseClient';
import Sidebar from './Sidebar';
import AuroraBackground from '../AuroraBackground';
import NotificationBell from '../NotificationBell';
import OfflineBanner from '../OfflineBanner';

// The greeting's role word. A `Record<UserRole, string>` rather than the chain
// of ternaries this used to be: that chain ended in `: 'Staff'`, so every role
// added after it was silently greeted as Staff — which is exactly what a new
// `ceo` would have been. A map makes a missing role a compile error, the same
// reason `checkableStatus.ts` is a full record rather than a lookup with a
// default.
const ROLE_GREETING: Record<UserRole, string> = {
  guard: 'Guard', hod: 'HOD', senior_manager: 'Senior Manager', staff: 'Staff',
  admin: 'Admin', ceo: 'CEO',
};

type Props = {
  session: Session;
  role: UserRole | null;
  children: React.ReactNode;
};

const COLLAPSE_KEY = 'securegate-sidebar-collapsed';

// Live top-right clock/date cluster — clock icon + time and calendar icon +
// date separated by a hairline divider, sitting immediately left of the
// notification bell (client instruction, 2026-08-14). No background panel:
// it sits directly on the topbar surface.
// IST explicitly, not the browser's zone — this deployment is IST wherever the
// laptop is, the same rule `istLocalToUtcIso` and the visit timeline follow. A
// topbar reading one zone while a visit's times read another is the worst place
// for the two to disagree.
const IST = 'Asia/Kolkata';

function TopbarClock(): React.ReactElement {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  // NO `dark:text-navy-*`. The navy scale is INVERTED in dark mode, so this
  // clock's old `text-navy-500 dark:text-navy-300` resolved to rgb(92,86,74)
  // on the dark topbar — the time and date were there and unreadable
  // (client report, 2026-08-15). One step, `navy-800`, is dark ink in light
  // mode and bright in dark. See CLAUDE.md.
  return (
    <span className="flex items-center gap-3 text-navy-800">
      <span className="flex items-center gap-2">
        <svg className="w-[1.05rem] h-[1.05rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="hidden sm:inline-flex font-display text-[0.9rem] font-semibold tabular-nums">
          {now.toLocaleTimeString('en-US', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true })}
        </span>
      </span>
      <span className="w-px h-5 bg-navy-300/20 dark:bg-white/15" aria-hidden="true" />
      <span className="flex items-center gap-2">
        <svg className="w-[1.05rem] h-[1.05rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        <span className="hidden sm:inline-flex font-display text-[0.9rem] font-semibold">
          {now.toLocaleDateString('en-US', { timeZone: IST, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </span>
    </span>
  );
}

// Computed once — Mac shows the ⌘ glyph, everyone else gets a spelled-out Ctrl.
const SHORTCUT_HINT = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K';

export default function AppShell({ session, role, children }: Props): React.ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return window.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [profileName, setProfileName] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Global ⌘K / Ctrl+K shortcut — focuses the topbar search from anywhere.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Fetch department name for greeting banner
  useEffect(() => {
    const fetchDept = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, department_id')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile?.full_name) setProfileName(profile.full_name.split(' ')[0] ?? '');
        if (profile?.department_id) {
          const { data: dept } = await supabase.from('departments').select('name').eq('id', profile.department_id).maybeSingle();
          if (dept?.name) setDeptName(dept.name);
        }
      } catch { /* ignore */ }
    };
    void fetchDept();
  }, [session.user.id]);

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-surface-50 relative">
      <AuroraBackground />

      <Sidebar session={session} role={role} collapsed={collapsed} onCollapsedChange={setCollapsed} />

      <div className={`app-shell-content relative z-10 flex flex-col min-h-screen safe-x safe-bottom transition-[padding] duration-300 ease-in-out ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[264px]'}`}>
        {/* Top strip — search, notifications.

            No bottom border and no drop shadow (client instruction,
            2026-08-14): the strip and the page beneath it are one continuous
            surface. The glass background is what separates it from content
            scrolling under it — a hairline plus a shadow on top of that drew a
            hard seam across every screen at the exact height the eye starts
            reading. */}
        <header className="no-print sticky top-0 z-30 card-glass !rounded-none !border-0 !shadow-none safe-top">
          <div className="flex items-center gap-3 h-16 px-4 sm:px-6 lg:px-8 pl-16 lg:pl-8">
            {/* Search bar — a contained pill, not a stretched box; sits with the
                notification bell as a right-hand action cluster. Hidden for the
                guard role per client instruction (2026-08-14): the guard console
                puts the clock + calendar in the page header instead, and the
                Search bar duplicated visual chrome at the top-right. */}
            <form
              onSubmit={handleSearch}
              className={`ml-auto min-w-0 w-40 sm:w-64 transition-[width] duration-200 ease-out ${searchFocused ? 'sm:w-80' : ''} ${role === 'guard' ? '!hidden' : ''}`}
            >
              <div className={`topbar-search relative flex items-center ${searchFocused ? 'is-focused' : ''}`}>
                <svg className="topbar-search-icon absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search visitors, passes..."
                  className="w-full h-9 pl-9 pr-9 bg-transparent border-0 text-sm text-navy-900 placeholder:text-navy-600 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }}
                    className="topbar-search-clear absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full"
                    aria-label="Clear search"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : (
                  <kbd className="topbar-search-kbd hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center justify-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide">
                    {SHORTCUT_HINT}
                  </kbd>
                )}
              </div>
            </form>

            {/* No scanner button here. Scanning is not a global action — it is
                a step inside CheckInPanel on /guard/pre-approvals, where the
                scanned pass immediately resolves to the visitor being checked
                in. A top-bar icon that jumped to a scanner with no check-in
                context around it was a shortcut to nowhere. */}

            {/* Date label sits immediately left of the notification bell,
                pinned to the far right of the topbar per client instruction
                (2026-08-14). */}
            <div className="ml-auto flex items-center gap-3">
              <TopbarClock />
              <NotificationBell userId={session.user.id} role={role} />
            </div>
          </div>
        </header>

        {/* Department greeting */}
        {deptName && (
          <div className="no-print px-4 sm:px-6 lg:px-8 pt-5 pb-0">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-bold text-navy-800">
                  {profileName ? `Welcome, ${profileName}` : 'Welcome'}
                  {role ? ` — ${ROLE_GREETING[role]}` : ''}
                </p>
                <p className="text-xs text-navy-700 mt-0.5">
                  {deptName}{deptName ? ' · ' : ''}{(() => {
                    const taglines: Record<string, string> = {
                      'information technology': 'Powering digital transformation',
                      'finance': 'Driving financial excellence',
                      'human resources': 'Building great teams',
                      'engineering': 'Engineering the future',
                      'marketing': 'Creating brand impact',
                      'operations': 'Keeping things running smooth',
                      'sales': 'Connecting with customers',
                      'administration': 'Managing the backbone',
                      'legal': 'Ensuring compliance & trust',
                      'security': 'Keeping everyone safe',
                      'procurement': 'Sourcing with precision',
                      'logistics': 'Moving things forward',
                    };
                    return taglines[deptName.toLowerCase()] ?? 'Making an impact every day';
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="app-shell-main flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {/* Above everything, on every screen: a list that has stopped
              updating must say so before it is read. See OfflineBanner. */}
          <OfflineBanner />
          {children}
        </main>

        {/* Footer */}
        <footer className="no-print px-8 pb-6">
          <p className="text-center text-[11px] text-navy-300 tracking-wide">
            Secure Gate — Visitor Management System
          </p>
        </footer>
      </div>
    </div>
  );
}
