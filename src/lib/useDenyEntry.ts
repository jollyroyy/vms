import { useCallback, useState } from 'react';
import type { ReportVisit } from './reportRow';
import { denyEntry } from './denyEntryFlow';

// The Deny Entry interaction, as one hook.
//
// Extracted out of GuardDashboardMain.tsx, which crossed the repo's 300-line
// hard cap when this landed. It is a real concern boundary rather than a
// line-count dodge: four pieces of state, one async write and one reset, none
// of which the dashboard's tiles, queue or drill-down ever touch.
//
// The TARGET is the visit, not a boolean, so the confirm dialog always names
// the person whose row was clicked even if the realtime subscription reorders
// the queue underneath it — the same reason GuardLiveQueue holds its exit
// target this way.

export type UseDenyEntry = {
  target: ReportVisit | null;
  busy: boolean;
  error: string;
  toast: string | null;
  /** Open the confirm for this visitor. */
  open: (visit: ReportVisit) => void;
  /** Dismiss the confirm without writing. Clears any previous error. */
  cancel: () => void;
  confirm: (visit: ReportVisit, reason: string) => Promise<void>;
  dismissToast: () => void;
};

export function useDenyEntry(onDenied?: () => void): UseDenyEntry {
  const [target, setTarget] = useState<ReportVisit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const confirm = useCallback(async (visit: ReportVisit, reason: string) => {
    setBusy(true);
    setError('');
    const res = await denyEntry(visit, reason);
    setBusy(false);
    // The error stays on screen and the dialog stays OPEN on failure: the guard
    // has a person in front of them and a reason already typed, and closing the
    // dialog would throw both away.
    if (!res.ok) { setError(res.message); return; }
    setTarget(null);
    onDenied?.();
    setToast(`Entry refused for "${visit.visitor?.full_name ?? 'visitor'}".`);
    setTimeout(() => setToast(null), 5000);
  }, [onDenied]);

  return {
    target,
    busy,
    error,
    toast,
    open: setTarget,
    cancel: useCallback(() => { setTarget(null); setError(''); }, []),
    confirm,
    dismissToast: useCallback(() => setToast(null), []),
  };
}
