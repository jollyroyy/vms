import type { VisitStatus } from '../types/index';

export type StatusStyle = {
  bg: string;
  text: string;
  dot: string;
  label: string;
};

export const STATUS_STYLES: Record<VisitStatus, StatusStyle> = {
  pending_approval: { bg: 'bg-amber-50',    text: 'text-amber-700',  dot: 'bg-amber-400', label: 'Pending' },
  // The two HOD approval routes are named apart on the badge: 'approved' is a
  // pre-approval raised ahead of the visit, 'walkin_approved' is an on-the-spot
  // approval of someone already at the gate. Both then wait on the gate check.
  approved:         { bg: 'bg-blue-50',     text: 'text-blue-700',   dot: 'bg-blue-500',  label: 'Pre-approved' },
  walkin_approved:  { bg: 'bg-indigo-50',   text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'Walk-in approved' },
  checked_in:       { bg: 'bg-success-50',  text: 'text-success-700',dot: 'bg-success-500',label: 'On-site' },
  checked_out:      { bg: 'bg-surface-100', text: 'text-navy-400',   dot: 'bg-navy-300',  label: 'Departed' },
  rejected:         { bg: 'bg-danger-50',   text: 'text-danger-700', dot: 'bg-danger-500', label: 'Denied' },
  cancelled:        { bg: 'bg-surface-100', text: 'text-navy-400',   dot: 'bg-navy-300',  label: 'Cancelled' },
  no_show:          { bg: 'bg-orange-50',  text: 'text-orange-700', dot: 'bg-orange-500', label: 'No Show' },
};

export const STATUS_COLORS = {
  pending: 'text-amber-600',
  approved: 'text-blue-600',
  denied: 'text-danger-600',
  'on-site': 'text-success-600',
  overdue: 'text-orange-500',
} as const;
