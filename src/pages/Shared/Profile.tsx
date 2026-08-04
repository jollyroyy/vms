// The one screen every role can reach: your own account. Opened from the
// profile button at the bottom of the sidebar, which used to fire a bare file
// picker — there was no way to see what your photo currently was, remove it, or
// check which department you had been assigned to.
//
// Reachable by all four roles, so it is listed LAST in every ROLE_ROUTES entry:
// the first entry of each list is that role's landing page (see roleRoutes.ts).
import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '../../types/index';
import { useMyProfile } from '../../lib/useMyProfile';
import { useDepartments } from '../../lib/useDepartments';
import ProfilePhotoCard from './ProfilePhotoCard';
import ProfileDetails from './ProfileDetails';

type Props = { session: Session; role: UserRole | null };

export default function ProfilePage({ session, role }: Props): React.ReactElement {
  const userId = session.user.id;
  const { profile, loading, error, saveName, setAvatarUrl } = useMyProfile(userId);
  const { departments } = useDepartments();

  // The JWT is the authority on role; the profile row is only a mirror of it
  // (sync_profile_role_to_auth, migration 010) and can lag a fresh promotion.
  const effectiveRole = role ?? profile?.role ?? null;
  const email = session.user.email ?? profile?.email ?? '';
  const deptName = departments.find((d) => d.id === profile?.department_id)?.name ?? '';

  const [announce, setAnnounce] = useState('');
  useEffect(() => { if (announce) { const t = setTimeout(() => setAnnounce(''), 4000); return () => clearTimeout(t); } }, [announce]);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-950 dark:text-white">My Profile</h1>
        <p className="text-sm text-navy-400 mt-1">Your photo and account details</p>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_1fr]">
          <div className="card p-6"><div className="skeleton h-28 w-28 rounded-full mx-auto" /></div>
          <div className="card p-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 w-full rounded-xl" />)}</div>
        </div>
      ) : error || !profile ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-danger-600">
            {error ?? 'We could not load your profile. Please refresh and try again.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,18rem)_1fr] items-start">
          <ProfilePhotoCard
            userId={userId}
            fullName={profile.full_name ?? ''}
            email={email}
            avatarUrl={profile.avatar_url}
            onAvatarChange={(url) => { setAvatarUrl(url); setAnnounce(url ? 'Photo updated' : 'Photo removed'); }}
          />
          <ProfileDetails
            fullName={profile.full_name ?? ''}
            email={email}
            role={effectiveRole}
            deptName={deptName}
            createdAt={profile.created_at}
            onSaveName={saveName}
          />
        </div>
      )}

      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}
