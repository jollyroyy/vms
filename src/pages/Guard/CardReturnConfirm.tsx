import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import ModalCloseButton from '../../components/ModalCloseButton';
import { useEscapeKey } from '../../lib/useEscapeKey';

type Props = {
  visit: Visit;
  onConfirm: () => void;
  onClose: () => void;
};

// The check-out gate. A visitor card is handed over at check-in (migration 076)
// and must come back at check-out — the guard is shown the number they need to
// collect and the check-out does not complete until they confirm it is back.
// The checkbox is the record of the exchange, like carrying_material: a ticked
// box means "I have it", and there is no inference path.
//
// A visitor with no card on record (legacy rows, kiosk check-ins) has nothing
// to collect, so no checkbox — but the dialog still names the visitor so the
// guard confirms the right person is leaving.
export default function CardReturnConfirm({ visit, onConfirm, onClose }: Props): React.ReactElement {
  const [collected, setCollected] = useState(false);
  const hasCard = Boolean(visit.visitor_card_number);
  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 relative" onClick={(e) => e.stopPropagation()}>
        <ModalCloseButton onClose={onClose} />
        {/* pr-14, not pr-8: the absolute × spans 16-52px from the right edge, so
            32px of padding left the heading running underneath it. */}
        <div className="pr-14">
          <h3 className="font-bold text-navy-900">Confirm check-out</h3>
          <p className="text-sm text-navy-700 mt-1">{visit.visitor?.full_name ?? 'Visitor'}</p>
        </div>

        <div className="rounded-xl border border-surface-200 dark:border-white/[0.07] px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-navy-700">Visitor card</span>
          {hasCard ? (
            <span className="font-mono font-bold text-navy-900">{visit.visitor_card_number}</span>
          ) : (
            <span className="text-xs text-navy-400">No card on record</span>
          )}
        </div>

        {hasCard ? (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={collected}
              onChange={(e) => setCollected(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-300 text-brand-600 focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-navy-800 dark:text-white">Card collected from visitor</span>
              <span className="block text-[11px] text-navy-500 dark:text-navy-400 mt-0.5">
                The check-out cannot complete until the card is back at the gate.
              </span>
            </span>
          </label>
        ) : (
          <p className="text-[11px] text-navy-500 dark:text-navy-400">
            No card was issued at check-in, so there is nothing to collect.
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-surface-50 hover:bg-surface-100 text-navy-700 font-bold rounded-xl py-2.5 text-sm transition-all">Cancel</button>
          <button
            type="button"
            disabled={hasCard && !collected}
            onClick={onConfirm}
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl py-2.5 text-sm transition-all disabled:opacity-50"
          >
            Complete Check Out
          </button>
        </div>
      </div>
    </div>
  );
}