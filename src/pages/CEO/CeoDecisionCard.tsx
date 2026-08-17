import React, { useState } from 'react';
import { initialsOf } from '../../lib/initials';
import { formatDateTime } from '../../lib/formatDate';
import { REMOVAL_NOTE_MAX } from '../../lib/blacklistRemoval';
import type { BlacklistRemovalRequest } from '../../types/index';

type Props = {
  request: BlacklistRemovalRequest;
  onDecide: (approve: boolean, note: string) => Promise<void>;
};

// One request, and the two things the CEO can do with it.
//
// THE CARD LEADS WITH WHAT IS BEING ASKED FOR, NOT WITH THE BUTTONS. The
// visitor, why they were blacklisted, the admin's case and who made it — all
// above the controls, in that order, because that is the order the decision is
// actually made in. A pair of Approve/Refuse buttons at the top of a card is
// an invitation to press one before reading it.
//
// A REFUSAL NEEDS A REASON AND AN APPROVAL DOES NOT. Approving grants exactly
// what the admin asked for, and their justification is already on the record;
// a second sentence would restate it. Refusing overrides a colleague who did
// write one, and "no" with nothing attached leaves them with nothing to act on
// — the same rule that makes the guard's Deny Entry reason mandatory. So the
// Refuse button stays DISABLED until a note exists, rather than warning after
// the fact: the reason is the only route to the write.
//
// APPROVING SAYS WHAT IT DOES, in so many words, on the button's own line.
// This is the click that lets somebody back into the building, and a bare
// "Approve" on a card headed by a name is the same class of understatement as
// a Delete that does not say what it deletes.

export default function CeoDecisionCard({ request, onDecide }: Props): React.ReactElement {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRefuse = note.trim().length > 0 && busy === null;

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    setError(null);
    try {
      await onDecide(approve, note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that decision.');
      setBusy(null);
    }
  };

  return (
    <li className="rounded-2xl bg-surface-100/60 dark:bg-white/[0.03] border border-surface-200/60
                   dark:border-white/[0.07] p-5 shadow-glow-sm space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 shrink-0 rounded-full bg-brand-600 flex items-center justify-center
                         text-white text-sm font-bold">
          {initialsOf(request.visitor?.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-950 dark:text-white truncate">
            {request.visitor?.full_name ?? 'Visitor record not found'}
          </p>
          <p className="text-xs text-navy-500 tabular-nums">
            {request.visitor?.phone ?? '—'}
            {request.visitor?.vendor_name ? ` · ${request.visitor.vendor_name}` : ''}
          </p>
        </div>
      </div>

      {/* The snapshot, not a join. The flag is cleared on approval, so this is
          the only surviving statement of what the visitor was flagged FOR —
          and it is the half of the decision the admin is arguing against. */}
      <div className="rounded-xl bg-danger-500/10 px-4 py-3">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-danger-600 dark:text-danger-400">
          Blacklisted for
        </p>
        <p className="text-sm text-navy-800 mt-1 break-words">
          {request.blacklist_reason?.trim() || 'No reason was recorded when the visitor was flagged'}
        </p>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-navy-500">
          The admin's case for removal
        </p>
        <p className="text-sm text-navy-800 mt-1 break-words">{request.justification}</p>
        <p className="text-xs text-navy-500 mt-2">
          {request.requester?.full_name ?? 'Not recorded'} · {formatDateTime(request.created_at)}
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="label">Your note (required to refuse)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={REMOVAL_NOTE_MAX}
          rows={2}
          placeholder="Optional when approving. Required when refusing."
          className="input w-full resize-none"
        />
      </label>

      {error && <p className="text-sm text-danger-600">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={!canRefuse}
          onClick={() => decide(false)}
          className="flex-1 bg-surface-50 hover:bg-surface-100 text-danger-600 font-bold rounded-xl
                     py-2.5 text-sm transition-all disabled:opacity-50"
        >
          {busy === 'reject' ? 'Recording…' : 'Refuse — stays blacklisted'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide(true)}
          className="flex-1 bg-success-600 hover:bg-success-700 text-white font-bold rounded-xl
                     py-2.5 text-sm transition-all disabled:opacity-50"
        >
          {busy === 'approve' ? 'Approving…' : 'Approve — remove from blacklist'}
        </button>
      </div>
    </li>
  );
}
