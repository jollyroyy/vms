import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { UserRole } from '../../types/index';
import { useTheme } from '../../lib/theme';
import SidebarAnalytics from './SidebarAnalytics';
import SidebarProfile from './SidebarProfile';
import Logo from '../Logo';
import { linksForRole } from './navLinks';
import ModalCloseButton from '../ModalCloseButton';
import { useEscapeKey } from '../../lib/useEscapeKey';

type Props = {
  session: Session;
  role: UserRole | null;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};


const COLLAPSE_KEY = 'securegate-sidebar-collapsed';

export default function Sidebar({ session, role, collapsed: collapsedProp, onCollapsedChange }: Props): React.ReactElement {
  const loc = useLocation();
  const { theme, toggleTheme } = useTheme();
  const email = session.user.email ?? 'User';
  const links = linksForRole(role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [deptName, setDeptName] = useState<string>('');
  const [profileDeptId, setProfileDeptId] = useState<string>('');
  const [collapsedInternal, setCollapsedInternal] = useState<boolean>(() => {
    try { return window.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  // Which nav item is active is decided per-link below; there are no groups
  // any more (the Visitors segments moved onto the page as KPI tiles), so
  // there is no expand/collapse state to hold.
  useEscapeKey(() => setMobileOpen(false), mobileOpen);
  const collapsed = collapsedProp ?? collapsedInternal;
  const setCollapsed = (next: boolean | ((c: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(collapsed) : next;
    setCollapsedInternal(value);
    onCollapsedChange?.(value);
  };
  const initials = profileName
    ? profileName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : (email.split('@')[0] ?? 'U').slice(0, 2).toUpperCase();

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const fetchProfile = async () => {
      const firstWord = (s: string) => {
        const part = s.split('@')[0]?.split('.')[0] ?? 'User';
        return part.charAt(0).toUpperCase() + part.slice(1);
      };
      try {
        const [{ data: profile }, { data: authData }] = await Promise.all([
          supabase.from('profiles').select('full_name, department_id').eq('id', session.user.id).maybeSingle(),
          supabase.auth.getUser(),
        ]);
        setProfileName(profile?.full_name?.trim() || firstWord(email));
        const jwtDeptId = ((authData?.user as any)?.app_metadata?.department_id ?? '') as string;
        const localProfileDeptId = (profile as any)?.department_id ?? '';
        const deptId = jwtDeptId || localProfileDeptId;
        setProfileDeptId(deptId);
        if (deptId) {
          const { data: dept } = await supabase.from('departments').select('name').eq('id', deptId).maybeSingle();
          setDeptName(dept?.name ?? '');
        }
      } catch {
        setProfileName(firstWord(email));
      }
    };
    void fetchProfile();
  }, [session.user.id, email]);

  const navContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <Link to="/" className={`flex items-center gap-3 px-4 pt-6 pb-7 shrink-0 group ${isCollapsed ? 'justify-center px-2' : ''}`}>
        <Logo size={isCollapsed ? 'sm' : 'md'} />
        {!isCollapsed && (
          <div className="min-w-0">
            <span className="font-display font-bold text-base text-navy-950 tracking-tight block leading-tight">Secure Gate</span>
            <span className="text-[10px] text-navy-500 dark:text-navy-400 block leading-tight mt-0.5">Visitor Management System</span>
          </div>
        )}
      </Link>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1.5 pb-4">
        {links.map((link) => {
          const { to, label, icon } = link;
          // A link may carry a query (the HOD's Walk-in desk and Visitor
          // schedule are `?tab=` views of /overview — they moved here from a
          // second tab bar inside the page, 2026-08-15). Path-only matching
          // would light every one of them at once, so a link WITH a query must
          // match the query exactly, and a link WITHOUT one must not match a
          // sibling that has one.
          const queryAt = to.indexOf('?');
          const toPath = queryAt === -1 ? to : to.slice(0, queryAt);
          const toQuery = queryAt === -1 ? '' : to.slice(queryAt + 1);
          const pathMatch = loc.pathname === toPath || (toPath !== '/' && loc.pathname.startsWith(toPath));
          const active = pathMatch && (toQuery ? loc.search === `?${toQuery}` : !loc.search.includes('tab='));
          return (
            <Link key={to} to={to} title={isCollapsed ? label : undefined}
              className={`sidebar-link px-3 py-2.5 ${isCollapsed ? 'justify-center !px-0' : ''} ${active ? 'sidebar-link-active' : ''}`}>
              <span className="shrink-0">{icon}</span>
              {!isCollapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Live analytics widget — admin only */}
      {profileDeptId && role === 'admin' && (
        <div className="shrink-0 pb-3">
          <SidebarAnalytics deptId={profileDeptId} isCollapsed={isCollapsed} />
        </div>
      )}

      {/* Bottom: theme toggle + profile */}
      <div className="shrink-0 px-3 pb-5 space-y-2">
        <button type="button" onClick={toggleTheme} aria-label="Toggle theme"
          className={`sidebar-link w-full px-3 py-2.5 ${isCollapsed ? 'justify-center !px-0' : ''}`}>
          <span className="shrink-0">
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
            )}
          </span>
          {!isCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <SidebarProfile session={session} role={role} isCollapsed={isCollapsed} profileName={profileName} initials={initials} deptName={deptName} />

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex justify-center pt-1">
          <button type="button" onClick={() => setCollapsed((c) => !c)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="h-8 w-8 flex items-center justify-center rounded-xl card-glass !rounded-xl
                       text-navy-500 dark:text-navy-400 hover:text-brand-600 hover:border-brand-500/30
                       hover:shadow-glow-sm active:scale-[0.95] transition-all duration-200">
            <svg className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"
        className="no-print lg:hidden fixed top-3.5 left-4 z-50 h-9 w-9 rounded-xl flex items-center justify-center text-navy-600 dark:text-navy-300 card-glass !rounded-xl active:scale-95 transition-all">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {mobileOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
        </svg>
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] card-glass !rounded-none !border-y-0 !border-l-0 animate-slide-down overflow-hidden">
            <ModalCloseButton onClose={() => setMobileOpen(false)} />
            {navContent(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`no-print hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40 card-glass !rounded-none !border-y-0 !border-l-0 transition-[width] duration-300 ease-in-out ${collapsed ? 'w-[84px]' : 'w-[264px]'}`}>
        {navContent(collapsed)}
      </aside>
    </>
  );
}
