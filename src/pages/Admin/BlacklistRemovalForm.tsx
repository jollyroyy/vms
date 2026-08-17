import React, { useState } from 'react';
import type { Visitor } from '../../types/index';
import ModalCloseButton from '../../components/ModalCloseButton';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { initialsOf } from '../../lib/initials';
import {
  requestBlacklistRemoval, removalJustificationError,
  REMOVAL_JUSTIFICATION_MAX, REMOVAL_JUSTIFICATION_MIN,
} from '../../lib/blacklistRemoval';

type Props = { visitor: Visitor; onClose: () => void; onFiled: () => void };

// The admin's half of a blacklist removal: name the person, say why, send it
// to the CEO.
//
// IT TAKES NO SEARCH STEP, unlike `AdminBlacklistForm` beside it, and the
// difference is not an omission. That form searches every visitor in the
// building because blacklisting somebody starts from a name in an incident
// report; this one is opened from a row of the blacklist itself, so the
// visitor is already chosen and re-picking them would only introduce the
// chance of picking somebody else. The identity card below is therefore a
// statement, not a control — there is no "Change".
//
// THE JUSTIFICATION IS THE ONLY ROUTE TO THE WRITE, the same gate
// `AdminBlacklistForm` and `CardReturnConfirm` use: the button stays disabled
// until it is valid. It also has a FLOOR, which the blacklist reason does not
// — a one-word "ok" is what a mandatory box collects when the only rule is
// non-empty, and this sentence is the entire case the CEO decides on.
//
// IT PROMISES NOTHING IT CANNOT KEEP. The copy says the request goes to the
// CEO and that the visitor stays blacklisted until then, because that is
// exactly what happens: nothing touches `visitors.is_blacklisted` here, and
// migration 092's trigger means nothing on this screen could.
export default function BlacklistRemovalForm({ visitor, onClose, onFiled }: Props): React.ReactElement {
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  const gateError = removalJustificationError(justification);
  const canSubmit = !gateError && !submitting;

  const handleSubmit = async () => {
    if (gateError) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestBlacklistRemoval(visitor.id, justification);
      onFiled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file this request.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-navy-900 rounded-2xl p-6 max-w-md w-full space-y-4 relative max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClose={onClose} />
        <div className="pr-14">
          <h3 className="font-bold text-navy-950 dark:text-white">Request blacklist removal</h3>
          <p className="text-sm text-navy-700 mt-1">
            Your justification goes to the CEO for approval. The visitor stays blacklisted until it is granted.
          </p>
        </div>

        <div className="rounded-xl border border-surface-200 dark:border-white/[0.08] px-4 py-3 flex items-center gap-3">
          <span className="w-9 h-9 shrink-0 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
            {initialsOf(visitor.full_name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-navy-950 dark:text-white truncate">{visitor.full_name}</span>
            <span className="block text-xs text-navy-500 tabular-nums">{visitor.phone}</span>
          </span>
        </div>

        {/* The reason they were flagged, restated where the case against it is
            being written. The CEO sees this too (it is snapshotted onto the
            request), so the admin is arguing against a sentence they can read
            rather than one they have to remember. */}
        <div className="rounded-xl bg-danger-500/10 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-danger-600 dark:text-danger-400">
            Currently blacklisted for
          </p>
          <p className="text-sm text-navy-800 mt-1 break-words">
            {visitor.blacklist_reason?.trim() || 'No reason recorded'}
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="label">Justification (required)</span>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            maxLength={REMOVAL_JUSTIFICATION_MAX}
            rows={4}
            placeholder={`Why should this visitor come off the blacklist? At least ${REMOVAL_JUSTIFICATION_MIN} characters.`}
            className="input w-full resize-none"
            autoFocus
          />
        </label>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-2.5 text-sm transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send to CEO'}
          </button>
        </div>
      </div>
    </div>
  );
}
