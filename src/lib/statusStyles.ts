import type { VisitStatus } from '../types/index';

export type StatusStyle = {
  bg: string;
  text: string;
  dot: string;
  label: string;
};

// Two kinds of colour live here and they behave differently in dark mode:
//
//   * surface/navy/success/danger `-50` and `-700` are CSS-variable tokens and
//     flip with the theme on their own — no dark: variant needed or wanted.
//   * amber/blue/indigo/orange are static Tailwind hues. Left bare they render
//     a light chip with dark text on top of a dark card, which is the one thing
//     that makes a dark surface look unfinished. They carry explicit dark:
//     variants — a low-alpha tint of the mid shade plus a light-300 text — the
//     same pattern OverviewUpcoming.tsx uses for its purpose chips.
//
// The dot is a small solid mark on either theme, so mid shades need no variant.
export const STATUS_STYLES: Record<VisitStatus, StatusStyle> = {
  pending_approval: { bg: 'bg-amber-50 dark:bg-amber-500/[0.12]', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-400', label: 'Pending' },
  // The two HOD approval routes are named apart on the badge: 'approved' is a
  // pre-approval raised ahead of the visit, 'walkin_approved' is an on-the-spot
  // approval of someone already at the gate. Both then wait on the gate check.
  approved:         { bg: 'bg-blue-50 dark:bg-blue-500/[0.12]',   text: 'text-blue-700 dark:text-blue-300',   dot: 'bg-blue-500',  label: 'Pre-approved' },
  walkin_approved:  { bg: 'bg-indigo-50 dark:bg-indigo-500/[0.12]', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', label: 'Walk-in approved' },
  checked_in:       { bg: 'bg-success-50',  text: 'text-success-700',dot: 'bg-success-500',label: 'On-site' },
  checked_out:      { bg: 'bg-surface-100', text: 'text-navy-400',   dot: 'bg-navy-300',  label: 'Departed' },
  rejected:         { bg: 'bg-danger-50',   text: 'text-danger-700', dot: 'bg-danger-500', label: 'Denied' },
  cancelled:        { bg: 'bg-surface-100', text: 'text-navy-400',   dot: 'bg-navy-300',  label: 'Cancelled' },
  no_show:          { bg: 'bg-orange-50 dark:bg-orange-500/[0.12]', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', label: 'No Show' },
};

export const STATUS_COLORS = {
  pending: 'text-amber-600',
  approved: 'text-blue-600',
  denied: 'text-danger-600',
  'on-site': 'text-success-600',
  overdue: 'text-orange-500',
} as const;
