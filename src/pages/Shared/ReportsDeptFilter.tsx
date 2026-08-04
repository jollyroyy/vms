// The register's department picker. One control, one decision: which
// department's visits am I looking at. Options come from the rows already
// loaded (see lib/reportsDeptFilter.ts), so every entry has a real count beside
// it and picking one can never open an empty table.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_DEPTS, deptFilterLabel, type DeptOption } from '../../lib/reportsDeptFilter';

type Props = {
  options: DeptOption[];
  value: string;
  onChange: (deptId: string) => void;
  total: number;
};

const SEARCH_THRESHOLD = 6;

export default function ReportsDeptFilter({ options, value, onChange, total }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const label = deptFilterLabel(options, value);
  const active = label !== 'All Departments';
  const showSearch = options.length >= SEARCH_THRESHOLD;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || (o.code ?? '').toLowerCase().includes(q));
  }, [options, query]);

  // Close on outside click and on Escape. Both are registered only while open,
  // so a closed filter costs nothing on a page that already re-renders on every
  // realtime tick.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
    if (!open) setQuery('');
  }, [open, showSearch]);

  const pick = (id: string): void => {
    onChange(id);
    setOpen(false);
  };

  // `z-50` sits on the ROOT, not just the panel. Every card on this page uses
  // `backdrop-filter`, which forces the browser to composite it on its own
  // layer — a z-index on the panel alone loses to a later card in DOM order and
  // the menu opens *underneath* the register. Raising the whole subtree fixes it.
  return (
    <div ref={rootRef} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by department"
        className={active ? 'dept-trigger dept-trigger-active' : 'dept-trigger'}
      >
        <span className="dept-trigger-icon" aria-hidden="true">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
        </span>
        {/* Two lines: the eyebrow says what the control does, the value says
            where the register currently stands. One line had to keep trading
            one of those away. */}
        <span className="min-w-0 text-left">
          <span className="dept-trigger-eyebrow">Department</span>
          <span className="dept-trigger-label">{label}</span>
        </span>
        <span className="dept-count">{active ? (options.find((o) => o.id === value)?.count ?? 0) : total}</span>
        <svg className={`w-3.5 h-3.5 shrink-0 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Clearing is one click and never hides behind the menu — the filter is
          the reason a register looks short, so undoing it must be obvious. */}
      {active && (
        <button
          type="button"
          onClick={() => onChange(ALL_DEPTS)}
          aria-label="Clear department filter"
          className="dept-clear"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {open && (
        <div className="dept-panel" role="listbox" aria-label="Departments">
          <div className="dept-panel-head">
            <span className="dept-panel-eyebrow">Show visits from</span>
            <span className="dept-panel-total">{total} total</span>
          </div>

          {showSearch && (
            <div className="px-2.5 pt-2.5 pb-0.5">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search departments…"
                aria-label="Search departments"
                className="input !py-2 !text-sm"
              />
            </div>
          )}

          <div className="dept-list">
            <button
              type="button"
              role="option"
              aria-selected={value === ALL_DEPTS}
              onClick={() => pick(ALL_DEPTS)}
              className={value === ALL_DEPTS ? 'dept-option dept-option-on' : 'dept-option'}
            >
              <span className="dept-mark dept-mark-all" aria-hidden="true">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </span>
              <span className="dept-option-name">All Departments</span>
              <span className="dept-option-count">{total}</span>
              {value === ALL_DEPTS && <Tick />}
            </button>

            <div className="dept-divider" />

            {shown.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={value === o.id}
                onClick={() => pick(o.id)}
                className={value === o.id ? 'dept-option dept-option-on' : 'dept-option'}
              >
                {/* Initials, not the code: a code can be absent, and two letters
                    give the eye a fixed anchor to run down the list against. */}
                <span className="dept-mark" aria-hidden="true">{initials(o.name)}</span>
                <span className="dept-option-name">{o.name}</span>
                {o.code && <span className="dept-code">{o.code}</span>}
                <span className="dept-option-count">{o.count}</span>
                {value === o.id && <Tick />}
              </button>
            ))}

            {shown.length === 0 && (
              <p className="px-3.5 py-6 text-center text-sm text-navy-300">
                {options.length === 0 ? 'No departments in this range' : `No department matches “${query}”`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Up to two initials from a department name ("Human Resources" → "HR"). */
function initials(name: string): string {
  const [first, second] = name.trim().split(/\s+/).filter(Boolean);
  if (!first) return '?';
  if (!second) return first.slice(0, 2).toUpperCase();
  return (first.slice(0, 1) + second.slice(0, 1)).toUpperCase();
}

function Tick(): React.ReactElement {
  return (
    <svg className="w-4 h-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
