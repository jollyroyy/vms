import type { ReportVisit } from './reportRow';

// What happened at the gate today, newest first.
//
// This is a PURE derivation of the rows useTodayVisits already holds — no
// query, no subscription. The feed was deleted once before because it ran its
// own fetch alongside the KPI tiles, which meant two answers to "what happened
// today" on one screen with nothing forcing them to agree. Deriving it from the
// same array the tiles count removes that failure mode entirely: if the feed
// shows an entry, the Entries tile counted it.
//
// One visit can produce SEVERAL events. A visitor who arrived at 09:00 and left
// at 11:00 is one row with `status = 'checked_out'`, but two things happened to
// them, and both belong in a log of things that happened.
export type ActivityKind = 'entry' | 'exit' | 'declined';

export type ActivityEvent = {
  /** `${visit.id}:${kind}` — a visit contributes more than one row, so the
   *  visit id alone is not a usable React key. */
  id: string;
  kind: ActivityKind;
  /** ISO timestamp of the moment itself, not of the row. */
  at: string;
  visit: ReportVisit;
};

const DEFAULT_LIMIT = 6;

/** The day's events, newest first, capped. */
export function recentActivity(visits: ReportVisit[], limit: number = DEFAULT_LIMIT): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const v of visits) {
    push(events, v, 'entry', v.checked_in_at);
    push(events, v, 'exit', v.checked_out_at);
    // An HOD declining a request is the one event with no timestamp column of
    // its own: it is recorded in audit_logs and arrives on the row as actorAt
    // (lib/visitActors.ts). Falling back to created_at keeps the row in the
    // feed at roughly the right place rather than dropping it.
    if (v.status === 'rejected') push(events, v, 'declined', v.actorAt ?? v.created_at);
  }

  return events.sort((a, b) => ms(b.at) - ms(a.at)).slice(0, limit);
}

/** Append an event, unless its moment is missing or unreadable. A timestamp
 *  that cannot be parsed has no place on a timeline — sorting it as 0 or NaN
 *  would silently file it at one end of the day. */
function push(into: ActivityEvent[], visit: ReportVisit, kind: ActivityKind, at: string | null | undefined): void {
  if (!at || Number.isNaN(ms(at))) return;
  into.push({ id: `${visit.id}:${kind}`, kind, at, visit });
}

function ms(iso: string): number {
  return new Date(iso).getTime();
}
