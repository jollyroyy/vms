import React, { useEffect, useRef, useState } from 'react';
import type { Visitor } from '../../types/index';
import ModalCloseButton from '../../components/ModalCloseButton';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { initialsOf } from '../../lib/initials';
import {
  searchVisitorsForBlacklist, blacklistVisitor, blacklistReasonError, BLACKLIST_REASON_MAX,
} from '../../lib/adminBlacklist';

const SEARCH_DEBOUNCE_MS = 300;

type Props = { onClose: () => void };

// The tab's one write, gated the way `CardReturnConfirm` gates a check-out:
// the confirm button stays disabled until the thing that must be true is
// true. There the tick was "the card is back"; here it is "a reason has been
// typed" — CLAUDE.md's instruction for this form names that gate directly.
// (DenyEntryConfirm.tsx, the guard's mandatory-reason refusal dialog this was
// asked to be modelled on, no longer exists in the app — it and its writes
// were deleted 2026-08-15 when the guard dashboard went read-only — so
// CardReturnConfirm is the live example of the same disabled-until-valid
// pattern, and this form follows it instead.)
//
// TWO GATES, NOT ONE: a visitor must be selected from search AND a reason
// must be typed. Search never auto-selects a single hit — an admin
// confirming they have the right person is exactly the check this form
// exists to force, on a write that follows someone around every check-in
// desk in the building from this point on.
export default function AdminBlacklistForm({ onClose }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Visitor[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Visitor | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEscapeKey(onClose);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      requestRef.current += 1;
      return;
    }
    setSearching(true);
    const id = ++requestRef.current;
    const timer = setTimeout(() => {
      void searchVisitorsForBlacklist(trimmed).then((visitors) => {
        if (id !== requestRef.current) return;
        setResults(visitors);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const gateError = blacklistReasonError(reason);
  const canSubmit = Boolean(selected) && !gateError && !submitting;

  const handleSubmit = async () => {
    if (!selected || gateError) return;
    setSubmitting(true);
    setError(null);
    try {
      await blacklistVisitor(selected.id, reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not blacklist this visitor.');
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
          <h3 className="font-bold text-navy-950 dark:text-white">Blacklist a visitor</h3>
          <p className="text-sm text-navy-700 mt-1">Search by phone or name, then give a reason.</p>
        </div>

        {!selected && (
          <div className="space-y-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phone or name…"
              className="input w-full"
              autoFocus
            />
            {searching && <p className="text-xs text-navy-500">Searching…</p>}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-navy-500">No visitor matches "{query.trim()}".</p>
            )}
            {results.length > 0 && (
              <ul className="rounded-xl border border-surface-200 dark:border-white/[0.08] divide-y divide-surface-200 dark:divide-white/[0.08] max-h-48 overflow-y-auto">
                {results.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(v)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-brand-600/5 transition-colors"
                    >
                      <span className="w-8 h-8 shrink-0 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                        {initialsOf(v.full_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-navy-950 dark:text-white truncate">{v.full_name}</span>
                        <span className="block text-xs text-navy-500 tabular-nums">{v.phone}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {selected && (
          <>
            <div className="rounded-xl border border-surface-200 dark:border-white/[0.08] px-4 py-3 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-navy-950 dark:text-white truncate">{selected.full_name}</span>
                <span className="block text-xs text-navy-500 tabular-nums">{selected.phone}</span>
              </span>
              <button
                type="button"
                onClick={() => { setSelected(null); setQuery(''); }}
                className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Change
              </button>
            </div>

            <label className="block space-y-1.5">
              <span className="label">Reason (required)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={BLACKLIST_REASON_MAX}
                rows={3}
                placeholder="Why is this visitor being blacklisted?"
                className="input w-full resize-none"
              />
            </label>
          </>
        )}

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-2.5 text-sm transition-all">Cancel</button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex-1 bg-danger-600 hover:bg-danger-700 text-white font-bold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50"
          >
            {submitting ? 'Blacklisting…' : 'Blacklist Visitor'}
          </button>
        </div>
      </div>
    </div>
  );
}
