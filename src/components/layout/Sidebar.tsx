import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { UserRole } from '../../types/index';
import { useTheme } from '../../lib/theme';

type Props = {
  session: Session;
  role: UserRole | null;
  /** Optional controlled collapse state (AppShell passes this; standalone use is uncontrolled). */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};
type NavLink = { to: string; label: string; icon: React.ReactNode; roles: UserRole[] };

const ALL_LINKS: NavLink[] = [
  { to: '/visitors', label: 'Visitors', roles: ['guard', 'hod', 'staff', 'admin', 'super_admin'], icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
  { to: '/guard/gate-passes', label: 'Gate Passes', roles: ['guard'], icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg> },
  { to: '/gate-passes', label: 'Material Passes', roles: ['hod', 'staff'], icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
  { to: '/approvals', label: 'Approvals', roles: ['hod'], icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { to: '/whos-inside', label: 'On-site', roles: ['guard', 'hod', 'staff'], icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg> },
  { to: '/reports', label: 'Reports', roles: ['hod', 'staff', 'admin', 'super_admin'], icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
  { to: '/admin', label: 'Settings', roles: ['admin', 'super_admin'], icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
];

const ROLE_LABELS: Record<UserRole, string> = {
  guard: 'Guard', hod: 'HOD', staff: 'Staff', admin: 'Admin', super_admin: 'Super Admin',
};

const COLLAPSE_KEY = 'securegate-sidebar-collapsed';

export default function Sidebar({ session, role, collapsed: collapsedProp, onCollapsedChange }: Props): React.ReactElement {
  const loc = useLocation();
  const { theme, toggleTheme } = useTheme();
  const email = session.user.email ?? 'User';
  const links = ALL_LINKS.filter((l) => role && l.roles.includes(role));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [deptName, setDeptName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsedInternal, setCollapsedInternal] = useState<boolean>(() => {
    try { return window.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
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

  // Close the mobile drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  // Fetch profile name + department + avatar
  useEffect(() => {
    const fetchProfile = async () => {
      const firstWord = (s: string) => {
        const part = s.split('@')[0]?.split('.')[0] ?? 'User';
        return part.charAt(0).toUpperCase() + part.slice(1);
      };
      try {
        const [{ data: profile }, { data: authData }] = await Promise.all([
          supabase.from('profiles').select('full_name, department_id, avatar_url').eq('id', session.user.id).maybeSingle(),
          supabase.auth.getUser(),
        ]);
        setProfileName(profile?.full_name?.trim() || firstWord(email));
        setAvatarUrl((profile as any)?.avatar_url ?? null);
        const jwtDeptId = ((authData?.user as any)?.app_metadata?.department_id ?? '') as string;
        const profileDeptId = (profile as any)?.department_id ?? '';
        const deptId = jwtDeptId || profileDeptId;
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

  // Upload avatar handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate file
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return; // 2 MB max

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `${session.user.id}/avatar.${ext}`;

      // Upload to storage (upsert to overwrite previous)
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // Get public URL
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // cache-bust

      // Save to profile
      await supabase.from('profiles').update({ avatar_url: publicUrl } as any).eq('id', session.user.id);
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const navContent = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <Link to="/" className={`flex items-center gap-3 px-4 pt-6 pb-7 shrink-0 group ${isCollapsed ? 'justify-center px-2' : ''}`}>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 blur-md opacity-40 group-hover:opacity-60 transition-opacity" />
          <div className="relative h-10 w-10 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-accent-500 flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <span className="font-display font-bold text-base text-navy-950 tracking-tight block leading-tight">SecureGate</span>
            <span className="text-[10px] text-navy-400 block leading-tight mt-0.5">Visitor &amp; Material Gate Pass</span>
          </div>
        )}
      </Link>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1.5 pb-4">
        {links.map(({ to, label, icon }) => {
          const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              title={isCollapsed ? label : undefined}
              className={`sidebar-link px-3 py-2.5 ${isCollapsed ? 'justify-center !px-0' : ''} ${active ? 'sidebar-link-active' : ''}`}
            >
              <span className="shrink-0">{icon}</span>
              {!isCollapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Bottom: theme toggle + user */}
      <div className="shrink-0 px-3 pb-5 space-y-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className={`sidebar-link w-full px-3 py-2.5 ${isCollapsed ? 'justify-center !px-0' : ''}`}
        >
          <span className="shrink-0">
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
            )}
          </span>
          {!isCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* Hidden file input for avatar upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarUpload}
        />

        <div className={`rounded-2xl border border-surface-200/60 dark:border-white/[0.06] bg-surface-100/60 dark:bg-white/[0.03] ${isCollapsed ? 'flex flex-col items-center p-2 gap-2' : 'p-3'}`}>
          {isCollapsed ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={profileName || 'Upload photo'}
                className="relative group"
                disabled={uploading}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profileName} className="h-10 w-10 rounded-full object-cover ring-2 ring-brand-500/30" />
                ) : (
                  <div className="avatar-md avatar-gradient">{initials}</div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                </div>
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                title="Sign out"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-navy-400 hover:text-danger-600 hover:bg-danger-500/10 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {/* Clickable avatar / photo */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change profile photo"
                className="relative shrink-0 group"
                disabled={uploading}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profileName}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-brand-500/30 group-hover:ring-brand-500/60 transition-all"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full avatar-gradient flex items-center justify-center text-xs font-semibold text-white">
                    {initials}
                  </div>
                )}
                {/* Hover overlay with camera icon */}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  {uploading ? (
                    <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                  )}
                </div>
              </button>

              {/* Name + Role + Department */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-navy-950 truncate leading-tight">{profileName || '—'}</p>
                {role && (
                  <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 leading-tight mt-0.5">
                    {ROLE_LABELS[role]}
                  </p>
                )}
                {deptName && (
                  <p className="text-xs font-medium text-navy-500 dark:text-navy-400 leading-tight mt-0.5 truncate">
                    {deptName}
                  </p>
                )}
              </div>

              {/* Sign out */}
              <button
                onClick={() => supabase.auth.signOut()}
                title="Sign out"
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-navy-400 hover:text-danger-600 hover:bg-danger-500/10 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="sidebar-link w-full px-3 py-2 hidden lg:flex justify-center"
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
          </svg>
          {!isCollapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger (sits inside topbar spacing) */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Open menu"
        className="lg:hidden fixed top-3.5 left-4 z-50 h-9 w-9 rounded-xl flex items-center justify-center text-navy-600 dark:text-navy-300 card-glass !rounded-xl active:scale-95 transition-all"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {mobileOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
        </svg>
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] card-glass !rounded-none !border-y-0 !border-l-0 animate-slide-down overflow-hidden">
            {navContent(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`no-print hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40 card-glass !rounded-none !border-y-0 !border-l-0 transition-[width] duration-300 ease-in-out ${
          collapsed ? 'w-[84px]' : 'w-[264px]'
        }`}
      >
        {navContent(collapsed)}
      </aside>
    </>
  );
}
