// Automatic host notification when the guard checks a visitor in.
//
// Fires once per visit, immediately after the visit row moves to
// `status = 'checked_in'`. The host who made the pre-approval receives a
// notification in the bell-icon dropdown at the top of their own VMS session
// (the existing `notifications` table + NotificationBell infrastructure) with
// the `visitor_checked_in` type the HOD screens already render as an
// "arrival" notice.
import { supabase } from '../supabaseClient';

export type NotifyOutcome = { notified: boolean; error?: string };

/**
 * Insert the check-in notice for the visit's host and stamp the remarks
 * marker. Idempotent: a second call (e.g. the guard tapping Notify Host)
 * reuses the same notification row instead of duplicating it.
 */
export async function notifyHostOnCheckIn(visit: {
  id: string;
  host_id: string | null;
  visitor_name?: string | null;
}): Promise<NotifyOutcome> {
  if (!visit.host_id) return { notified: false };
  try {
    // Reuse the existing notification row for this visit when one is already
    // there (e.g. guard tapped "Notify Host" before), so the host sees a
    // single bell entry regardless of which lane triggered it.
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('recipient_id', visit.host_id)
      .eq('related_id', visit.id)
      .eq('type', 'visitor_checked_in')
      .maybeSingle();
    if (existing) {
      // The bell badge only counts unread — a brand-new check-in must surface,
      // so reset an old read notice to unread.
      await supabase.from('notifications').update({ is_read: false }).eq('id', existing.id);
      return { notified: true };
    }

    const body = `${visit.visitor_name ?? 'Your visitor'} has checked in at the gate.`;
    const { error } = await supabase.from('notifications').insert({
      recipient_id: visit.host_id,
      type: 'visitor_checked_in',
      title: 'Your visitor has checked in',
      body,
      related_id: visit.id,
      is_read: false,
    } as never);
    if (error) throw error;
    return { notified: true };
  } catch (err) {
    return { notified: false, error: err instanceof Error ? err.message : 'Notification failed' };
  }
}
