import React from 'react';
import type { IdScanResult } from './idScanTypes';

/**
 * What the ID scan actually read, kept on screen after the guard accepts it.
 *
 * The overlay's review dialog showed document / number / name / date of birth
 * and then closed, leaving a single green line reading "Identity verified —
 * PAN ••••234F". The guard is holding a physical card and comparing it against
 * a record, which is exactly the moment those fields are needed; a verdict on
 * its own asks them to trust the match without seeing what was matched.
 *
 * On a MATCH the approved name is deliberately not repeated — the summary card
 * above already carries it, and printing the same string twice makes the eye
 * check whether the two agree (CLAUDE.md's no-duplicate-renders rule). On a
 * MISMATCH both names are printed, because the difference between them is the
 * entire finding.
 */
export type ScanVerdict = 'match' | 'mismatch' | 'no-name';

type Props = {
  scan: IdScanResult;
  verdict: ScanVerdict;
  /** The name this visit was approved under, for the mismatch comparison. */
  approvedName: string;
  /** Drop the scan and show the "Scan ID card" button again. */
  onDiscard: () => void;
  /** Reopen the scanner, keeping the current result until a new one lands. */
  onRescan: () => void;
  /** Has the guard already waved this mismatch through? */
  overridden?: boolean;
  /** Wave it through. Omitted where no override is offered. */
  onOverride?: () => void;
};

const TONE: Record<ScanVerdict, { box: string; heading: string; title: string }> = {
  match: {
    box: 'bg-success-50 border-success-200 dark:border-success-500/25',
    heading: 'text-success-700',
    title: 'Identity verified',
  },
  mismatch: {
    box: 'bg-danger-50 border-danger-200 dark:border-danger-500/25',
    heading: 'text-danger-700',
    title: "Name doesn't match the approved visitor",
  },
  'no-name': {
    box: 'bg-accent-50 border-accent-200 dark:bg-accent-500/10 dark:border-accent-500/25',
    heading: 'text-accent-700 dark:text-accent-300',
    title: 'ID recorded — no name could be read',
  },
};

function Row({ term, value }: { term: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-navy-700 shrink-0">{term}</dt>
      <dd className="font-semibold text-navy-950 text-right break-words">{value}</dd>
    </div>
  );
}

export default function CheckInScanSummary({
  scan, verdict, approvedName, onDiscard, onRescan, overridden = false, onOverride,
}: Props): React.ReactElement {
  const tone = TONE[verdict];
  // The masked number when the scan carried one, otherwise the four digits that
  // are actually stored. Never the raw number — it is not kept anywhere.
  const number = scan.masked || (scan.idLast4 ? `•••• ${scan.idLast4}` : '');

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm space-y-2.5 ${tone.box}`}>
      <p className={`font-bold ${tone.heading}`}>{tone.title}</p>

      <dl className="text-xs space-y-1.5">
        {scan.idType && <Row term="Document" value={scan.idType} />}
        {number && <Row term="ID number" value={number} />}
        {/* The name AS PRINTED ON THE CARD. On a match it is the same string as
            the approved name above, so the caption states the relationship
            instead of repeating that name a second time. */}
        {scan.name && <Row term="Name on ID" value={scan.name} />}
        {scan.dateOfBirth && <Row term="Date of birth" value={scan.dateOfBirth} />}
      </dl>

      {verdict === 'mismatch' && (
        <p className="text-xs text-danger-700/80">Approved as {approvedName}</p>
      )}
      {verdict === 'match' && (
        <p className="text-xs text-success-700/80">Matches the approved visitor.</p>
      )}

      {/* THE GUARD MAY OVERRIDE A MISMATCH (client instruction, 2026-08-17).
          A refused name is usually the OCR and not an impostor — a married
          name, an initial the parser ate, a Devanagari card read in a
          different word order — and the visitor is standing at the gate while
          the queue builds behind them. Blocking on it delays honest people to
          catch a case the guard is already better placed to judge, holding the
          card and looking at the face.

          NO REASON IS COLLECTED, on the client's explicit instruction: a
          mandatory text box at a gate is a queue. What IS recorded is that an
          override happened (`visits.id_match_overridden`, migration 097), so
          the record never claims an identity check that did not pass — the
          fact without the explanation, which costs the guard nothing.

          Two presses, not one: the button states what it is doing, and once
          pressed the box says so plainly rather than turning green, because
          this is not a match and must never read like one. */}
      {verdict === 'mismatch' && onOverride && (
        overridden ? (
          <p className="text-xs font-bold text-danger-700">
            Overridden by you — the visitor may be checked in, and this is recorded on the visit.
          </p>
        ) : (
          <button
            type="button"
            onClick={onOverride}
            className="w-full rounded-lg border border-danger-500/40 bg-white/70 dark:bg-white/[0.06] px-3 py-2 text-xs font-bold text-danger-700 hover:bg-white transition-colors"
          >
            Names differ — check in anyway
          </button>
        )
      )}

      <div className="flex items-center gap-3 pt-0.5">
        <button type="button" onClick={onRescan}
          className={`text-xs font-bold underline underline-offset-2 ${tone.heading}`}>
          Rescan
        </button>
        <button type="button" onClick={onDiscard}
          className={`text-xs font-bold underline underline-offset-2 ${tone.heading}`}>
          Discard scan
        </button>
      </div>
    </div>
  );
}
