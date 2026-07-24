import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

type StaffType = 'maid' | 'worker' | 'vendor';

interface DailyEntry {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_company: string | null;
  purpose: string;
  status: string;
  type: StaffType;
  check_in_time: string | null;
  check_out_time: string | null;
  department_name: string;
}

const TYPE_META: Record<StaffType, { label: string; color: string; bg: string }> = {
  maid:   { label: 'Maid',   color: 'text-accent-600',  bg: 'bg-accent-50 border-accent-200/60' },
  worker: { label: 'Worker', color: 'text-brand-600',    bg: 'bg-brand-50 border-brand-200/60' },
  vendor: { label: 'Vendor', color: 'text-amber-600',    bg: 'bg-amber-50 border-amber-200/60' },
};

const PURPOSE_TO_TYPE: Record<string, StaffType> = {
  vendor: 'vendor', delivery: 'vendor',
  maintenance: 'worker',
};

function purposeToType(purpose: string): StaffType {
  return PURPOSE_TO_TYPE[purpose] ?? 'worker';
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
}

type Tab = 'today' | 'checked_in' | 'checked_out';

export default function DailyStaff(): React.ReactElement {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('today');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<StaffType | 'all'>('all');

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // Fetch today's visits that are vendor/maintenance/delivery/maid type
    const { data: visits } = await supabase
      .from('visits')
      .select('id, visitor_name, visitor_phone, visitor_company, purpose, status, check_in_time, check_out_time, departments(name)')
      .gte('created_at', `${today}T00:00:00Z`)
      .in('purpose', ['vendor', 'delivery', 'maintenance']);

    const mapped: DailyEntry[] = ((visits ?? []) as any[]).map(v => ({
      id: v.id,
      visitor_name: v.visitor_name,
      visitor_phone: v.visitor_phone ?? '',
      visitor_company: v.visitor_company ?? null,
      purpose: v.purpose,
      status: v.status,
      type: purposeToType(v.purpose),
      check_in_time: v.check_in_time ?? null,
      check_out_time: v.check_out_time ?? null,
      department_name: v.departments?.name ?? 'General',
    }));

    setEntries(mapped);
    if (!silent) setLoading(false);
  }, [today]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('daily-staff-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const stats = useMemo(() => {
    const total = entries.length;
    const checkedIn = entries.filter(e => e.status === 'checked_in').length;
    const checkedOut = entries.filter(e => e.status === 'checked_out').length;
    const expected = entries.filter(e => ['approved', 'walkin_approved'].includes(e.status)).length;
    return { total, checkedIn, checkedOut, expected };
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (tab === 'checked_in') list = list.filter(e => e.status === 'checked_in');
    else if (tab === 'checked_out') list = list.filter(e => e.status === 'checked_out');
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.visitor_name.toLowerCase().includes(q) || e.visitor_phone.includes(q) || (e.visitor_company ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [entries, tab, typeFilter, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-accent-500 to-brand-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <div>
          <h1 className="page-title">Daily Staff</h1>
          <p className="page-subtitle">Vendors, maids &amp; workers expected today</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Today', value: stats.total, color: 'text-brand-600', bg: 'bg-brand-50', ring: 'ring-brand-500/10' },
          { label: 'Checked In', value: stats.checkedIn, color: 'text-success-600', bg: 'bg-success-50', ring: 'ring-success-500/10' },
          { label: 'Checked Out', value: stats.checkedOut, color: 'text-navy-600', bg: 'bg-surface-100', ring: 'ring-navy-500/10' },
          { label: 'Expected', value: stats.expected, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-500/10' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-white/[0.04] rounded-xl border border-surface-200 dark:border-white/[0.06] p-4">
            <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{loading ? '—' : card.value}</p>
            <p className="text-xs text-navy-400 font-medium mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="tab-group">
          {([['today', 'All Today'], ['checked_in', 'Inside'], ['checked_out', 'Left']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={tab === key ? 'tab-active' : 'tab-inactive'}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input type="text" placeholder="Search..." className="input pl-9 w-44" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto pr-8" value={typeFilter} onChange={e => setTypeFilter(e.target.value as StaffType | 'all')}>
            <option value="all">All Types</option>
            <option value="maid">Maid</option>
            <option value="worker">Worker</option>
            <option value="vendor">Vendor</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="loader" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-navy-600">No daily staff visits found</p>
          <p className="text-xs text-navy-400 mt-1">{search ? 'Try a different search term' : 'No vendors, maids, or workers expected today'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(entry => {
            const meta = TYPE_META[entry.type];
            const isInside = entry.status === 'checked_in';
            const isOut = entry.status === 'checked_out';
            return (
              <div key={entry.id} className="card-hover p-5 group relative">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl avatar-gradient flex items-center justify-center text-sm font-bold shrink-0">
                    {getInitials(entry.visitor_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-navy-900 dark:text-white truncate">{entry.visitor_name}</p>
                      {isInside && (
                        <span className="status-badge bg-success-50 text-success-700 border border-success-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse-soft" />
                          In
                        </span>
                      )}
                      {isOut && (
                        <span className="status-badge bg-surface-100 text-navy-500 border border-surface-200">Left</span>
                      )}
                      {!isInside && !isOut && (
                        <span className="status-badge bg-amber-50 text-amber-600 border border-amber-200/60">Expected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`status-badge ${meta.bg} ${meta.color}`}>{meta.label}</span>
                      <span className="text-xs text-navy-400">{entry.department_name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-navy-400">
                      {entry.visitor_phone && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                          {entry.visitor_phone}
                        </span>
                      )}
                      {entry.visitor_company && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                          </svg>
                          {entry.visitor_company}
                        </span>
                      )}
                      {entry.check_in_time && (
                        <span className="flex items-center gap-1 text-success-600">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(entry.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
