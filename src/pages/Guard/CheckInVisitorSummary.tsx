// What the guard sees the moment a pass is scanned (or a search result picked):
// the record behind the QR, laid out so it can be checked against the person
// standing at the gate. The QR encodes only an opaque token — every detail here
// was fetched from the visit row it resolved to, which is why the ID number can
// be shown redacted rather than travelling in the code itself.
import React from 'react';
import PassIdentity from '../../components/PassIdentity';
import { formatDateTime } from '../../lib/formatDate';
import type { MatchItem } from './checkInTypes';

// THE TYPE OF VISITOR — walk-in or pre-approved — named in full on the one
// screen EVERY check-in passes through (client instruction, 2026-08-16:
// "whenever anybody's checking in they should be able to recognize by the field
// type of visitor"). CheckInPhotoStep renders this summary for the
// pre-approvals desk, the scan desk, the walk-in desk and the dashboard's
// Verify ID modal, so labelling it here covers all four without a fifth copy of
// the answer.
//
// The words are `lib/visitOrigin.ts`'s own, which is what makes this the same
// fact the dashboard column, the Entry & Exit table and the visitor cards
// print. It used to read "Walk-in approved" — the clearance, not the visitor.
const APPROVAL_LABEL: Record<MatchItem['approvalType'], string> = {
  pre_approved: 'Pre-approved',
  walk_in: 'Walk-in',
  recurring: 'Regular visitor',
};

const APPROVAL_BADGE: Record<MatchItem['approvalType'], string> = {
  pre_approved: 'bg-success-50 text-success-700',
  walk_in: 'bg-amber-50 text-amber-700 dark:bg-amber-500/12 dark:text-amber-300',
  recurring: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
};

type Props = { match: MatchItem };

export default function CheckInVisitorSummary({ match }: Props): React.ReactElement {
  const label = APPROVAL_LABEL[match.approvalType];

  return (
    <div className="space-y-3">
      <PassIdentity
        photoUrl={match.photoUrl}
        name={match.visitorName}
        vendorName={match.vendorName}
        idType={match.idType}
        idLast4={match.idLast4}
      />

      {/* The field is NAMED, not left as a bare pill: a coloured badge reading
          "Walk-in" is only legible to someone who already knows what that badge
          is for, and this is the moment a guard is being asked to recognise it.
          The pill stays as the value — it is what makes the answer glanceable
          at a gate — so the fact is still rendered exactly once. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-navy-500 dark:text-navy-400">Type of Visitor</span>
        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${APPROVAL_BADGE[match.approvalType]}`}>
          {label}
        </span>
        {match.refNumber && (
          <span className="text-[11px] font-mono text-navy-500 dark:text-navy-400">{match.refNumber}</span>
        )}
      </div>

      <dl className="text-xs space-y-1.5 border-t border-surface-100 pt-3">
        <Row term="Purpose" value={match.purpose} capitalize />
        {/* Department used to be its own row above this one — folded under
            Person to Meet instead, so it is never printed twice on this
            summary. */}
        <Row term="Person to Meet" value={match.hostName} sub={match.departmentName} />
        {/* The exact instant of approval, not a relative "2 hours ago" — a guard
            challenged on why someone was let in needs the timestamp itself. */}
        {/* "Approved at", not "<type> at": the type of visitor is the field
            above, and repeating it here would be the same fact twice on one
            summary. This row is about WHEN the clearance was given. */}
        {match.approvedAt && <Row term="Approved at" value={formatDateTime(match.approvedAt)} />}
        {/* Date and time, never a bare time: an open pre-approval can be booked
            for any day, so the date is what says whether this one is due now. */}
        <Row term="Expected" value={match.scheduledFor ? formatDateTime(match.scheduledFor) : 'Anytime today'} />
      </dl>
    </div>
  );
}

function Row({ term, value, capitalize, sub }: { term: string; value: string; capitalize?: boolean; sub?: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-navy-500 dark:text-navy-400 shrink-0">{term}</dt>
      <dd className={`font-semibold text-navy-700 text-right truncate ${capitalize ? 'capitalize' : ''}`}>
        {value || '—'}
        {value && sub && <span className="block text-[10px] font-normal text-navy-500 dark:text-navy-400 truncate">{sub}</span>}
      </dd>
    </div>
  );
}
