// Avatar upload/removal against the public `avatars` bucket (migration 053).
//
// The object path is a fixed `${userId}/avatar` with NO extension, on purpose:
// storage stores the content type alongside the object, and a stable path means
// an upsert replaces the previous photo instead of leaving a `.png` orphaned
// next to the new `.jpg`. It also makes removal exact — we know the one key to
// delete. RLS keys on the first path segment being the caller's uid, so a user
// can only ever write inside their own folder.
import { supabase } from '../supabaseClient';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarResult = { url: string | null } | { error: string };

/** Returns an error message, or null when the file is an acceptable avatar. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose an image file (JPG, PNG or WebP).';
  if (file.size > MAX_AVATAR_BYTES) return 'That image is over 2 MB. Please choose a smaller one.';
  return null;
}

export function avatarPath(userId: string): string {
  return `${userId}/avatar`;
}

export async function uploadAvatar(userId: string, file: File): Promise<AvatarResult> {
  const invalid = validateAvatarFile(file);
  if (invalid) return { error: invalid };

  const path = avatarPath(userId);
  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) {
    const msg = uploadErr.message ?? '';
    // The bucket is created by migration 053; a missing bucket is a deployment
    // problem, not something the user can fix by retrying.
    if (/bucket/i.test(msg) || /not found/i.test(msg)) {
      return { error: 'Photo storage is not configured on this environment (migration 053).' };
    }
    return { error: msg || 'Upload failed. Please try again.' };
  }

  // Public bucket, so no signed URL. The timestamp defeats the browser cache —
  // the object key never changes, so without it the old photo stays on screen.
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url } as never)
    .eq('id', userId);

  if (profileErr) {
    return { error: 'Photo uploaded, but saving it to your profile failed. Please try again.' };
  }
  return { url };
}

export async function removeAvatar(userId: string): Promise<AvatarResult> {
  // Clear the profile first: that is the field every screen reads, so a failed
  // storage delete leaves an orphaned object rather than a broken <img>.
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ avatar_url: null } as never)
    .eq('id', userId);

  if (profileErr) return { error: profileErr.message || 'Could not remove your photo.' };

  await supabase.storage.from('avatars').remove([avatarPath(userId)]);
  return { url: null };
}
