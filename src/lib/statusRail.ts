import type { VisitStatus } from '../types/index';

// Which colour rail runs down the leading edge of a visitor card.
//
// Deliberately COARSER than STATUS_STYLES: the rail is a scanning aid, so it
// groups eight statuses into five situations a guard actually acts on. The
// precise status is always still spelled out in the text badge beside it —
// the rail never carries meaning on its own (glare and colour-blindness both
// defeat colour-only encoding).
//
// Direct lookup map, not an includes() chain — see CLAUDE.md.
export const STATUS_RAIL: Record<VisitStatus, string> = {
  checked_in:       'rail-inside',
  approved:         'rail-expected',
  walkin_approved:  'rail-expected',
  pending_approval: 'rail-pending',
  checked_out:      'rail-out',
  cancelled:        'rail-out',
  no_show:          'rail-out',
  expired:          'rail-out',
  lapsed:           'rail-out',
  rejected:         'rail-flagged',
};

export function railFor(status: VisitStatus): string {
  return STATUS_RAIL[status] ?? 'rail-out';
}
