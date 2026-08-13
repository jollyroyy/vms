import React from 'react';
import type { Visit } from '../../types/index';
import { formatDateTime, formatElapsed } from '../../lib/formatDate';

type Props = { visit: Visit };

// The middle column of the stacked card: the facts a guard checks the person in
// front of them against. Which time is shown depends on where the visit is —
// showing "Expected Time" beside someone who is already inside answers a
// question nobody is asking.
//
// Times for a visitor still inside carry the DATE as well. This list is
// deliberately not date-bounded for open visits, so a bare "08:15" on someone
// who arrived last night reads as this morning.
export default function VisitorStackFacts({ visit: v }: Props): React.ReactElement {
  return (
    <dl className="stack-card-facts">
      {timeFacts(v).map((f) => (
        <Fact key={f.term} icon={f.icon} term={f.term} value={f.value} />
      ))}
      <Fact icon={ICON_PHONE} term="Contact" value={v.visitor?.phone ?? '—'} tabular />
      <Fact icon={ICON_CAR} term="Vehicle" value={v.visitor?.vehicle_number || 'None'} tabular />
    </dl>
  );
}

type TimeFact = { icon: string; term: string; value: string };

function timeFacts(v: Visit): TimeFact[] {
  if (v.checked_out_at) {
    return [
      { icon: ICON_CLOCK, term: 'Checked In', value: formatDateTime(v.checked_in_at) },
      { icon: ICON_EXIT, term: 'Checked Out', value: formatDateTime(v.checked_out_at) },
    ];
  }
  if (v.checked_in_at) {
    return [
      { icon: ICON_CLOCK, term: 'Checked In', value: formatDateTime(v.checked_in_at) },
      { icon: ICON_HOURGLASS, term: 'On Site', value: formatElapsed(v.checked_in_at).text },
      // Only when the approver actually set one. A fabricated deadline is worse
      // than none — see migration 073 on why expected_departure is optional.
      ...(v.expected_departure
        ? [{ icon: ICON_EXIT, term: 'Due Out', value: formatDateTime(v.expected_departure) }]
        : []),
    ];
  }
  return [
    {
      icon: ICON_CLOCK,
      term: 'Expected Time',
      // Date AND time, always (client instruction, 2026-08-13). This list is
      // never date-bounded for open statuses — a booking made last week for
      // today, and one for next month, sit in the same array — so a bare
      // "03:30" is unreadable: it says when but not whether that when is now.
      // A booking with no slot is legal only on the walk-in path; "Anytime" is
      // honest about it rather than printing a dash that looks like missing data.
      value: v.scheduled_for ? formatDateTime(v.scheduled_for) : 'Anytime',
    },
    { icon: ICON_TICKET, term: 'Reference', value: v.ref_number ?? '—' },
  ];
}

function Fact({ icon, term, value, tabular }: { icon: string; term: string; value: string; tabular?: boolean }) {
  return (
    <div className="stack-fact">
      <svg className="stack-fact-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <div className="min-w-0">
        <dt className="stack-fact-term">{term}</dt>
        <dd className={`stack-fact-value ${tabular ? 'tabular-nums' : ''}`}>{value}</dd>
      </div>
    </div>
  );
}

const ICON_CLOCK = 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_PHONE = 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z';
const ICON_CAR = 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-6m0 0v-14.25A1.125 1.125 0 019.375 3.375h3.75c.621 0 1.125.504 1.125 1.125v14.25m0 0h-6';
const ICON_TICKET = 'M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z';
const ICON_HOURGLASS = 'M6.75 3v2.25M6.75 3h10.5M6.75 3H5.25m12 0v2.25m0-2.25h1.5M6.75 5.25c0 3 5.25 4.5 5.25 6.75S6.75 15.75 6.75 18.75M17.25 5.25c0 3-5.25 4.5-5.25 6.75s5.25 3.75 5.25 6.75M6.75 18.75V21m0-2.25H5.25m1.5 0h10.5m0 0V21m0-2.25h1.5';
const ICON_EXIT = 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9';
