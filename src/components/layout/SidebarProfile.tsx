import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { UserRole } from '../../types/index';

const ROLE_LABELS: Record<UserRole, string> = {
  guard: 'Guard', hod: 'HOD', staff: 'Staff', admin: 'Admin',
};

const CAMERA_ICON = 'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z';
const CIRCLE_ICON = 'M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z';
const SIGNOUT_ICON = 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9';

type Props = {
  session: Session;
  role: UserRole | null;
  isCollapsed: boolean;
  profileName: string;
  initials: string;
  deptName: string;
};

export default function SidebarProfile({ session, role, isCollapsed, profileName, initials, deptName }: Props): React.ReactElement {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch avatar on mount
  useEffect(() => {
    supabase.from('profiles').select('avatar_url').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if ((data as any)?.avatar_url) setAvatarUrl((data as any).avatar_url);
    });
  }, [session.user.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Image must be under 2 MB.'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `${session.user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadErr) {
        if (uploadErr.message?.includes('not found') || uploadErr.message?.includes('Bucket')) {
          setAvatarError('Storage not configured. Please run migration 033.');
        } else {
          setAvatarError(uploadErr.message || 'Upload failed.');
        }
        throw uploadErr;
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      const { error: profileErr } = await supabase.from('profiles').update({ avatar_url: publicUrl } as any).eq('id', session.user.id);
      if (profileErr) {
        setAvatarError('Photo uploaded but profile update failed. Try again.');
        return;
      }
      setAvatarUrl(publicUrl);
    } catch { /* logged above */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setAvatarError(''), 5000);
    }
  };

  const avatarButton = (size: string, overlaySize: string) => (
    <button type="button" onClick={() => fileInputRef.current?.click()} title="Change profile photo" className="relative shrink-0 group" disabled={uploading}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={profileName} className={`${size} rounded-full object-cover ring-2 ring-brand-500/30 group-hover:ring-brand-500/60 transition-all`} />
      ) : (
        <div className={`${size} rounded-full avatar-gradient flex items-center justify-center text-xs font-semibold text-white`}>{initials}</div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
        {uploading ? (
          <svg className={`${overlaySize} text-white animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : (
          <svg className={`${overlaySize} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={CAMERA_ICON} /><path strokeLinecap="round" strokeLinejoin="round" d={CIRCLE_ICON} /></svg>
        )}
      </div>
    </button>
  );

  const signOutButton = (
    <button onClick={() => supabase.auth.signOut()} title="Sign out" className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-navy-400 hover:text-danger-600 hover:bg-danger-500/10 transition-all duration-200">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={SIGNOUT_ICON} /></svg>
    </button>
  );

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      <div className={`rounded-2xl border border-surface-200/60 dark:border-white/[0.06] bg-surface-100/60 dark:bg-white/[0.03] ${isCollapsed ? 'flex flex-col items-center p-2 gap-2' : 'p-3'}`}>
        {isCollapsed ? (
          <>
            {avatarButton('h-10 w-10', 'w-3.5 h-3.5')}
            {signOutButton}
          </>
        ) : (
          <div className="flex items-center gap-3">
            {avatarButton('h-11 w-11', 'w-4 h-4')}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy-950 truncate leading-tight">{profileName || '—'}</p>
              {role && <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 leading-tight mt-0.5">{ROLE_LABELS[role]}</p>}
              {deptName && <p className="text-xs font-medium text-navy-500 dark:text-navy-400 leading-tight mt-0.5 truncate">{deptName}</p>}
            </div>
            {signOutButton}
          </div>
        )}
      </div>

      {avatarError && <p className="text-[11px] text-danger-600 font-medium text-center px-2 animate-fade-in">{avatarError}</p>}
    </>
  );
}
