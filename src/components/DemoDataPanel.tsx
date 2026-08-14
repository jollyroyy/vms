import React, { useEffect, useState } from 'react';
import { countDemoVisits, seedDemoVisitors, clearDemoData, isDemoSchemaReady } from '../lib/demoSeed';

/**
 * Walkthrough demo control — the guard console surface for the demo visitor
 * seed. The user asked to SEE arrivals with photos: this seeds six realistic
 * visitors (real rows in the DB, so photos, queues, tiles and the check-in
 * flow render exactly like production) and lets the same operator wipe them
 * with one click. Nothing here touches a non-demo row.
 */
export default function DemoDataPanel(): React.ReactElement {
  const [ready, setReady] = useState<boolean | null>(null);
  const [count, setCount] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await isDemoSchemaReady();
      if (cancelled) return;
      setReady(r);
      if (r) setCount(await countDemoVisits());
    })();
    return () => { cancelled = true; };
  }, []);

  if (ready === null) return <></>;

  const seed = async () => {
    setBusy(true);
    const outcome = await seedDemoVisitors();
    setBusy(false);
    if (outcome.ok) {
      setCount((c) => c + outcome.seeded);
      setNotice(outcome.skipped > 0
        ? `Seeded ${outcome.seeded} demo visitor${outcome.seeded === 1 ? '' : 's'}${outcome.skipped > 0 ? ` (${outcome.skipped} already present today)` : ''}.`
        : `Seeded ${outcome.seeded} demo visitor${outcome.seeded === 1 ? '' : 's'} — they appear in the queue and tiles like real arrivals.`);
    } else {
      setNotice(outcome.message);
    }
  };

  const clear = async () => {
    if (count === 0) { setNotice('No demo data to clear.'); return; }
    setBusy(true);
    const outcome = await clearDemoData();
    setBusy(false);
    if (outcome.ok) {
      setCount(0);
      setNotice(`Cleared ${outcome.clearedVisits} demo visit${outcome.clearedVisits === 1 ? '' : 's'} and ${outcome.clearedVisitors} demo visitor record${outcome.clearedVisitors === 1 ? '' : 's'}. Real data was not touched.`);
    } else {
      setNotice(outcome.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3 bg-brand-50 dark:bg-brand-950/60 border border-brand-500/20 dark:border-brand-400/25">
        <div className="flex flex-wrap items-center gap-2">
          <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-9-9c2.39 0 4.68.94 6.36 2.64L21 8.25v3.75z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            Walkthrough demo
          </span>
          <span className="text-xs text-navy-500 dark:text-navy-400">
            {ready && count > 0
              ? `${count} demo visitor${count === 1 ? '' : 's'} on site today`
              : ready
                ? 'No demo visitors right now'
                : 'Demo mode unavailable'}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-navy-500 dark:text-navy-400">
          {ready
            ? 'Seed six realistic arrivals — with photos — so the console, tiles and check-in flow behave like a live shift. Every demo row is tagged and can be wiped in one click; real records are never touched.'
            : 'The demo marker column has not been added to the database yet — run the 078_demo_marker migration in your Supabase dashboard (SQL editor), then reload.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={seed}
            disabled={busy || !ready}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Seed demo visitors
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={busy || count === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold border border-brand-500/30 dark:border-brand-400/30 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-950/60 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Clear demo data
          </button>
        </div>
        {notice && (
          <p className="mt-2.5 rounded-lg px-3 py-2 text-xs bg-surface-100 dark:bg-white/[0.04] border border-surface-200/70 dark:border-white/[0.06] text-navy-600 dark:text-navy-300">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
