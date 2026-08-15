// Watchlist escalation — what "Dispatch Security" and "Notify Admin" actually do.
//
// These two buttons used to write to `visits.remarks`:
//
//   remarks: ((row as { remarks?: string }).remarks && ' - ' ? '' : '') + suffix
//
// which always evaluates to `'' + suffix`, so pressing either one REPLACED the
// column with the bare string ' - SECURITY DISPATCHED'. Two things were wrong
// with that, and only one of them was the typo:
//
//   1. `visits.remarks` is the walk-in note an HOD reads when deciding an
//      approval (migration 068), and Reports prints it. Guard escalation
//      bookkeeping landed inside a colleague's approval card and destroyed the
//      note that was there.
//   2. A magic substring in free prose is not a flag. Nothing stops a genuine
//      remark from containing it.
//
// This is the same defect, and the same fix, as the Notify Host button:
// escalation is a message to a person, so it goes in the `notifications` table
// the bell icon already reads. See lib/notifyHostCheckIn.ts.
import { supabase } from '../supabaseClient';

export type EscalationAction = 'dispatch' | 'notify';

export type EscalationOutcome = { ok: true; recipients: number } | { ok: false; message: string };

const COPY: Record<EscalationAction, { title: string; verb: string }> = {
  dispatch: {
    title: 'Security dispatch requested at the gate',
    verb: 'requested a security dispatch for',
  },
  notify: {
    title: 'Watchlist match flagged for review',
    verb: 'flagged a watchlist match for',
  },
};

/**
 * Raise a flagged watchlist match to every admin.
 *
 * Admins are the recipients because they are the only role with a standing
 * route to this system's records; there is no security-team entity and no
 * paging integration in the schema, so the honest claim is "the people who can
 * act on this have been told", not "a team has been dispatched". The button
 * copy says exactly that much and no more.
 *
 * Idempotent per visit per action: pressing twice re-surfaces the existing
 * notice (marks it unread) instead of stacking duplicates on the admin's bell.
 */
export async function escalateWatchlistMatch(args: {
  visitId: string;
  visitorName: string | null;
  reason: string | null;
  action: EscalationAction;
}): Promise<EscalationOutcome> {
  const { visitId, visitorName, reason, action } = args;
  try {
    const { data: admins, error: adminErr } = await supabase
      .from('profiles')
      .select('id')
      // `super_admin` exists in the database's role enum but not in the app's
      // UserRole union (src/types/index.ts lists the four roles this UI has
      // screens for), so it is filtered as data rather than as a typed role.
      // Leaving it out would silently skip the strongest account on a
      // deployment that has one.
      .in('role', ['admin', 'super_admin'] as never);
    if (adminErr) throw adminErr;

    const recipients = (admins ?? []) as { id: string }[];
    if (recipients.length === 0) {
      // Better to say so than to show a success toast for a message with
      // nowhere to go.
      return { ok: false, message: 'No admin account exists to receive this alert.' };
    }

    const who = visitorName ?? 'A flagged visitor';
    const why = reason?.trim();
    const body = `The guard on duty has ${COPY[action].verb} ${who} at the gate${why ? ` (watchlist reason: ${why})` : ''}.`;

    const { data: existing, error: exErr } = await supabase
      .from('notifications')
      .select('id, recipient_id')
      .eq('related_id', visitId)
      .eq('type', 'watchlist_escalation');
    if (exErr) throw exErr;

    const already = new Set(((existing ?? []) as { recipient_id: string }[]).map((r) => r.recipient_id));

    const fresh = recipients.filter((r) => !already.has(r.id));
    if (fresh.length > 0) {
      const { error } = await supabase.from('notifications').insert(
        fresh.map((r) => ({
          recipient_id: r.id,
          type: 'watchlist_escalation',
          title: COPY[action].title,
          body,
          related_id: visitId,
          is_read: false,
        })) as never,
      );
      if (error) throw error;
    }

    // An earlier escalation on the same visit is re-raised rather than
    // duplicated — the bell badge counts unread, so an admin who already
    // dismissed one must still see the second press.
    const seenIds = ((existing ?? []) as { id: string }[]).map((r) => r.id);
    if (seenIds.length > 0) {
      await supabase.from('notifications').update({ is_read: false, title: COPY[action].title, body }).in('id', seenIds);
    }

    return { ok: true, recipients: recipients.length };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Could not raise the alert.' };
  }
}
