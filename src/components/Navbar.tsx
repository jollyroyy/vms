import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import type { UserRole } from '../types/index';

type Props = { session: Session; role: UserRole | null };
type NavLink = { to: string; label: string; roles: UserRole[] };

const ALL_LINKS: NavLink[] = [
  { to: '/guard',       label: 'Console',       roles: ['guard', 'admin', 'super_admin'] },
  { to: '/approvals',   label: 'Approvals',     roles: ['hod', 'admin', 'super_admin'] },
  { to: '/whos-inside', label: "Who's Inside",  roles: ['guard', 'hod', 'staff', 'admin', 'super_admin'] },
  { to: '/gate-passes', label: 'Gate Passes',   roles: ['guard', 'hod', 'staff', 'admin', 'super_admin'] },
  { to: '/reports',     label: 'Reports',       roles: ['guard', 'hod', 'staff', 'admin', 'super_admin'] },
  { to: '/admin',       label: 'Admin',         roles: ['admin', 'super_admin'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  guard: 'Guard', hod: 'HOD', staff: 'Staff', admin: 'Admin', super_admin: 'Super Admin',
};

export default function Navbar({ session, role }: Props): React.ReactElement {
  const loc = useLocation();
  const email = session.user.email ?? 'User';
  const links = ALL_LINKS.filter((l) => role && l.roles.includes(role));
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (email.split('@')[0] ?? 'U').slice(0, 2).toUpperCase();

  return (
    <nav className="no-print sticky top-0 z-40 bg-navy-950 border-b border-navy-800/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-7 w-7 rounded-md bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">V</span>
            </div>
            <span className="font-semibold text-sm text-white tracking-tight hidden sm:block">VMS</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {links.map(({ to, label }) => {
              const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`relative px-3 py-1.5 rounded-md text-sm transition-colors duration-150 ${
                    active
                      ? 'text-white font-medium'
                      : 'text-navy-300 hover:text-white'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-brand-400" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5 shrink-0">
            {role && (
              <span className="hidden sm:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-md bg-navy-800 text-navy-300 border border-navy-700/50">
                {ROLE_LABELS[role]}
              </span>
            )}

            <div className="relative group">
              <button className="h-8 w-8 rounded-full bg-navy-800 border border-navy-700/60 flex items-center justify-center hover:border-navy-600 transition-colors" title={email}>
                <span className="text-navy-200 text-[11px] font-semibold">{initials}</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="mt-1.5 bg-white rounded-xl shadow-elevated border border-surface-200 py-1.5 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-surface-100">
                    <p className="text-sm font-medium text-navy-900 truncate">{email}</p>
                    <p className="text-xs text-navy-400 mt-0.5">{role ? ROLE_LABELS[role] : 'Unknown'}</p>
                  </div>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="w-full text-left px-4 py-2 text-sm text-navy-500 hover:bg-surface-50 hover:text-red-600 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 rounded-md text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-3 pt-1 border-t border-navy-800/60 space-y-0.5">
            {links.map(({ to, label }) => {
              const active = loc.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-navy-800 text-white' : 'text-navy-300 hover:text-white hover:bg-navy-900'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
