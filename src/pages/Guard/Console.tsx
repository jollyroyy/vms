import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import GuardConsoleModeTabs, { type Mode } from './GuardConsoleModeTabs';
import GuardConsoleModeContent from './GuardConsoleModeContent';
// No CheckInPanel import any more — see the header comment below.
// No Badge import: the guard console must never render an entry pass. See
// canRoleShowPass in lib/passVisibility.ts for why. Badge draws a live QR
// straight from visit.qr_token and has no role gate of its own, so wiring it
// back in here would reintroduce the leak that gate exists to close.

// This page is the WALK-IN lane. CheckInPanel — the QR gate, the pre-approved
// match search and the check-in that follows — has moved to /guard/pre-approvals,
// because everything it does concerns a visitor who was booked in advance. A
// walk-in is by definition someone nobody expected, so pairing the two on one
// screen meant a guard scanned past the pre-approved half every time. The two
// arrival routes are now two destinations.
//
// What stays here is the pair of things a walk-in needs: register the arrival,
// and — on the Inside tab — let anyone out again. Inside deliberately lists
// EVERY checked-in visitor, pre-approved ones included: it is the exit lane,
// and a visitor who cannot be checked out is a visitor who never leaves the
// system. Only the Walk-ins tab is walk-in-only.
//
// URL tab → mode. Kept as a lookup map (CLAUDE.md forbids includes() chains for
// known enums). Old deep-links (dashboard tiles, bookmarks, the former sidebar
// sub-nav, the former audit tabs) must not 404 into a blank tab, so every
// legacy value degrades onto a live one.
const TAB_MODE_MAP: Record<string, Mode> = {
  walkins: 'walkins',
  inside: 'inside',
  // Legacy aliases — old links must not 404 into a blank tab.
  expected: 'inside',
  checkin: 'inside',
  exit: 'inside',
  'checked-out': 'inside',
  rejected: 'inside',
  all: 'inside',
  'no-show': 'inside',
};

export default function GuardConsole(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  // Defaults to walk-ins: that is what this page is now for. Check-out is a
  // deliberate second step, one tab away.
  const initialMode: Mode = (tabParam && TAB_MODE_MAP[tabParam]) ? TAB_MODE_MAP[tabParam]! : 'walkins';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg, setSuccessMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  // Keep the URL honest so the tab survives a refresh. `replace` so
  // tab-flipping doesn't fill history.
  const changeMode = useCallback((next: Mode) => {
    setMode(next);
    setSearchParams({ tab: next }, { replace: true });
  }, [setSearchParams]);

  // A deep link arriving after mount (dashboard tile, bookmark) must move the tab.
  useEffect(() => {
    if (tabParam && TAB_MODE_MAP[tabParam]) setMode(TAB_MODE_MAP[tabParam]!);
  }, [tabParam]);

  const loadVisits = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('visits')
      .select(`*, visitor:visitors(*), department:departments(id, name, code, created_at)`)
      .gte('created_at', `${today}T00:00:00Z`)
      .order('created_at', { ascending: false });
    if (error) { console.error('[Console] loadVisits error:', error.message); }
    let rows = ((data as unknown as Visit[]) ?? []);
    rows = await attachHostNames(rows);
    setVisits(rows.map((v) => ({ ...v, photo_url: v.photo_data ?? undefined })));
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => {
    void loadVisits();
    const channel = supabase
      .channel('guard-visits')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void loadVisits(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadVisits]);

  const logExit = async (visit: Visit) => {
    if (visit.status !== 'checked_in') { setActionErr('Visitor is not checked in.'); return; }
    setActionErr('');
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('visits')
        .update({ status: 'checked_out', checked_out_at: now, exit_verified: true })
        .eq('id', visit.id);
      if (error) { setActionErr(safeErrorMessage(error, 'Failed to log exit.')); return; }
      setSuccessMsg(`"${visit.visitor?.full_name ?? 'Visitor'}" checked out.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      void loadVisits(true);
    } catch (err) { setActionErr(safeErrorMessage(err, 'Failed to log exit.')); }
  };

  const checkedIn = useMemo(() => visits.filter((v) => v.status === 'checked_in'), [visits]);
  const pendingWalkIns = useMemo(() => visits.filter((v) => v.status === 'pending_approval'), [visits]);

  const onCheckInSuccess = useCallback((name: string) => {
    setSuccessMsg(`"${name}" checked in successfully.`);
    void loadVisits(true);
    setTimeout(() => setSuccessMsg(''), 6000);
  }, [loadVisits]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-4">
      <header>
        <h1 className="page-title">Walk-in Visitors</h1>
        <p className="page-subtitle">Register unannounced arrivals and let visitors out</p>
      </header>

      {successMsg && (
        <div className="alert-success">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span className="flex-1 font-semibold">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}
      {actionErr && (
        <div className="alert-error">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="flex-1 font-semibold">{actionErr}</span>
          <button onClick={() => setActionErr('')} className="text-xs font-bold opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <GuardConsoleModeTabs
        mode={mode}
        onModeChange={changeMode}
        walkInCount={pendingWalkIns.length}
        insideCount={checkedIn.length}
      />

      <GuardConsoleModeContent
        mode={mode}
        onCheckInSuccess={onCheckInSuccess}
        loading={loading}
        checkedIn={checkedIn}
        pendingWalkIns={pendingWalkIns}
        onCheckOut={logExit}
      />
    </div>
  );
}
