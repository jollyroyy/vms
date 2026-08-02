import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Visit } from '../../types/index';
import { attachHostNames } from '../../lib/hostNames';
import { safeErrorMessage } from '../../lib/errors';
import GuardConsoleModeTabs, { type Mode } from './GuardConsoleModeTabs';
import GuardConsoleModeContent from './GuardConsoleModeContent';
// No Badge import: the guard console must never render an entry pass. See
// canRoleShowPass in lib/passVisibility.ts for why. Badge draws a live QR
// straight from visit.qr_token and has no role gate of its own, so wiring it
// back in here would reintroduce the leak that gate exists to close.

// URL tab → mode. Kept as a lookup map (CLAUDE.md forbids includes() chains for
// known enums). Only three modes are live now — the audit views (checked-out /
// rejected / all) were removed from the guard surface entirely — but old
// deep-links (dashboard tiles, bookmarks, the former sidebar sub-nav, and the
// former audit tabs themselves) must not 404 into a blank tab, so every
// legacy value degrades gracefully onto the nearest live tab instead.
const TAB_MODE_MAP: Record<string, Mode> = {
  expected: 'expected',
  walkins: 'walkins',
  inside: 'inside',
  // Legacy aliases — old links must not 404 into a blank tab.
  checkin: 'expected',
  exit: 'inside',
  'checked-out': 'inside',
  rejected: 'expected',
  all: 'expected',
  'no-show': 'expected',
};

export default function GuardConsole(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialMode: Mode = (tabParam && TAB_MODE_MAP[tabParam]) ? TAB_MODE_MAP[tabParam]! : 'expected';

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
  const expected = useMemo(
    () => visits.filter((v) => v.status === 'approved' || v.status === 'walkin_approved'),
    [visits],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in pb-4">
      <header>
        <h1 className="page-title">Visitors</h1>
        <p className="page-subtitle">Check visitors in and out, and register walk-ins</p>
      </header>

      <GuardConsoleModeTabs
        mode={mode}
        onModeChange={changeMode}
        expectedCount={expected.length}
        walkInCount={pendingWalkIns.length}
        insideCount={checkedIn.length}
      />

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

      <GuardConsoleModeContent
        mode={mode}
        today={today}
        onCheckInSuccess={(name) => {
          setSuccessMsg(`"${name}" checked in successfully.`);
          void loadVisits(true);
          setTimeout(() => setSuccessMsg(''), 6000);
        }}
        loading={loading}
        checkedIn={checkedIn}
        pendingWalkIns={pendingWalkIns}
        onCheckOut={logExit}
      />
    </div>
  );
}
