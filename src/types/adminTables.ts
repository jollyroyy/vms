// The tables the admin surface added (migrations 084, 086, 087, 089, 091).
//
// Split out of `types/index.ts` rather than appended to it: that file mirrors
// the live schema and was already at 275 lines, and this project's 300-line cap
// has no "it is just types" exemption. The split is by ORIGIN — these four
// tables arrived together with the admin console and are read by it alone,
// which is a seam a reader can predict, unlike an arbitrary halfway cut.
//
// Re-exported from `types/index.ts`, so every existing `from '../types/index'`
// import keeps working and nothing has to learn a second path.

import type { Visit, Visitor, Profile } from './index';

/** A physical door. A table rather than an enum or a text column so a gate can
 *  be retired (`active = false`) while keeping the visits that came through
 *  it — see migration 084. */
export type EntryPoint = {
  id: string;
  name: string;
  code: string;
  kind: 'reception' | 'gate';
  active: boolean;
  sort_order: number;
  created_at: string;
};

/** One rating per visit, enforced by a unique index — the mean shown on the
 *  dashboard is computed at read time and never stored (migration 086). */
export type VisitFeedback = {
  id: string;
  visit_id: string;
  rating: number; // 1-5
  comment: string | null;
  created_at: string;
};

export type BadgeType = 'visitor' | 'contractor' | 'reprint';

/** A LOG of badges printed at the gate, not a print queue. The admin tab reads
 *  it and never writes it — minting an entry credential stays with the guard
 *  who can see the visitor (migration 087). */
export type BadgePrint = {
  id: string;
  visit_id: string;
  printed_by: string | null;
  badge_type: BadgeType;
  printed_at: string;
  visit?: Visit;
};

/** A row of the key/value settings store (migration 089). The typed schema and
 *  the defaults live in `src/lib/appSettings.ts`. */
export type AppSetting = {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
};

/** A request to take a visitor OFF the blacklist (migration 091).
 *
 *  `blacklist_reason` is a SNAPSHOT taken when the request was filed, not a
 *  join: approving the request clears `visitors.blacklist_reason`, so without
 *  the copy the record of what the CEO was actually asked to forgive would be
 *  destroyed by the act of granting it.
 *
 *  A pending row carries no `decided_by` / `decided_at` and a decided row
 *  carries both — a CHECK constraint, not a convention. */
export type BlacklistRemovalStatus = 'pending' | 'approved' | 'rejected';

export type BlacklistRemovalRequest = {
  id: string;
  visitor_id: string;
  requested_by: string;
  justification: string;
  blacklist_reason: string | null;
  status: BlacklistRemovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  // joined
  visitor?: Pick<Visitor, 'id' | 'full_name' | 'phone' | 'vendor_name' | 'is_blacklisted'>;
  requester?: Pick<Profile, 'id' | 'full_name'>;
  decider?: Pick<Profile, 'id' | 'full_name'>;
};
