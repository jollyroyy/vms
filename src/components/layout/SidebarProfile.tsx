import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { UserRole } from '../../types/index';

const ROLE_LABELS: Record<UserRole, string> = {
  guard: 'Guard', hod: 'HOD', staff: 'Staff', admin: 'Admin',
};

const SIGNOUT_ICON = 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9';

type Props = {
  session: Session;
  role: UserRole | null;
  isCollapsed: boolean;
  profileName: string;
  initials: string;
  deptName: string;
};

// Clicking this block opens /profile. It used to open a file picker directly,
// which meant there was no way to see the photo you already had, remove it, or
// read back which role and department you had been assigned — the upload lives
// on the page now (pages/Shared/Profile.tsx).
export default function SidebarProfile({ session, role, isCollapsed, profileName, initials, deptName }: Props): React.ReactElement {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const loc = useLocation();
  const onProfile = loc.pathname.startsWith('/profile');

  // Re-read on navigation so returning from /profile shows the new photo
  // without a reload — the avatar is written on that page, not this one.
  useEffect(() => {
    let cancelled = false;
    supabase.from('profiles').select('avatar_url').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (!cancelled) setAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url ?? null);
    });
    return () => { cancelled = true; };
  }, [session.user.id, loc.pathname]);

  const avatar = (size: string) => (
    avatarUrl ? (
      <img src={avatarUrl} alt={profileName} className={`${size} rounded-full object-cover ring-2 ring-brand-500/30 group-hover:ring-brand-500/60 transition-all`} />
    ) : (
      <div className={`${size} rounded-full avatar-gradient flex items-center justify-center text-xs font-semibold text-white`}>{initials}</div>
    )
  );

  const signOutButton = (
    <button onClick={() => supabase.auth.signOut()} title="Sign out" aria-label="Sign out"
      className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-navy-400 hover:text-danger-600 hover:bg-danger-500/10 transition-all duration-200">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={SIGNOUT_ICON} /></svg>
    </button>
  );

  return (
    <div className={`rounded-2xl border transition-colors ${onProfile
      ? 'border-brand-500/40 bg-brand-500/10'
      : 'border-surface-200/60 dark:border-white/[0.06] bg-surface-100/60 dark:bg-white/[0.03]'} ${isCollapsed ? 'flex flex-col items-center p-2 gap-2' : 'p-3'}`}>
      {isCollapsed ? (
        <>
          <Link to="/profile" title="My profile" aria-label="My profile" aria-current={onProfile ? 'page' : undefined} className="group shrink-0">
            {avatar('h-10 w-10')}
          </Link>
          {signOutButton}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <Link to="/profile" aria-current={onProfile ? 'page' : undefined}
            className="group flex items-center gap-3 min-w-0 flex-1 rounded-xl -m-1 p-1 hover:bg-white/40 dark:hover:bg-white/[0.04] transition-colors">
            {avatar('h-11 w-11')}
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-bold text-navy-950 dark:text-white truncate leading-tight">{profileName || '—'}</p>
              {role && <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 leading-tight mt-0.5">{ROLE_LABELS[role]}</p>}
              {deptName && <p className="text-xs font-medium text-navy-500 dark:text-navy-400 leading-tight mt-0.5 truncate">{deptName}</p>}
            </div>
          </Link>
          {signOutButton}
        </div>
      )}
    </div>
  );
}
