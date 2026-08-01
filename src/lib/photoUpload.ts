// Upload a captured photo to the visitor-photos bucket and return both the
// storage path and a usable data URL (signed URL, or base64 fallback when the
// upload fails — the check-in must not die because storage hiccuped).
import { supabase } from '../supabaseClient';

export async function uploadPhoto(blob: Blob): Promise<{ photoPath: string | null; photoData: string | null }> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.readAsDataURL(blob);
  });
  const filePath = `visits/${Date.now()}.webp`;
  const { error: uploadErr } = await supabase.storage
    .from('visitor-photos')
    .upload(filePath, blob, { contentType: 'image/webp', upsert: true });
  if (uploadErr) {
    return { photoPath: null, photoData: base64 };
  }
  const { data: urlData } = await supabase.storage
    .from('visitor-photos')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7);
  return { photoPath: filePath, photoData: urlData?.signedUrl ?? base64 };
}
