// At-a-glance strip above the department list. Each tile is a button: clicking a
// count is the only way to reveal the records behind it, so the page opens as a
// summary and the admin drills in deliberately. Clicking the active tile again
// collapses the panel.
import React from 'react';
import type { AdminOverviewView } from './adminOverviewView';

type Props = {
  departmentCount: number;
  hodCount: number;
  unassignedCount: number;
  active: AdminOverviewView | null;
  onSelect: (view: AdminOverviewView) => void;
  panelId: string;
};

type Tile = {
  view: AdminOverviewView;
  label: string;
  value: number;
  accent: string;
  ring: string;
  icon: React.ReactNode;
};

export default function AdminStats({
  departmentCount, hodCount, unassignedCount, active, onSelect, panelId,
}: Props): React.ReactElement {
  const tiles: Tile[] = [
    {
      view: 'departments',
      label: 'Departments',
      value: departmentCount,
      accent: 'from-brand-500/20 to-brand-600/5 text-brand-600 dark:text-brand-300 border-brand-500/20',
      ring: 'ring-brand-500/60',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />,
    },
    {
      view: 'hods',
      label: 'Heads of Department',
      value: hodCount,
      accent: 'from-accent-500/20 to-accent-600/5 text-accent-600 dark:text-accent-300 border-accent-500/20',
      ring: 'ring-accent-500/60',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
    },
    {
      view: 'unassigned',
      label: 'Awaiting an HOD',
      value: unassignedCount,
      accent: 'from-warning-500/20 to-warning-600/5 text-warning-600 dark:text-warning-500 border-warning-500/20',
      ring: 'ring-warning-500/60',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {tiles.map((t, i) => {
        const isActive = active === t.view;
        return (
          <button
            key={t.view}
            type="button"
            onClick={() => onSelect(t.view)}
            aria-pressed={isActive}
            aria-controls={panelId}
            title={`Show ${t.label}`}
            className={`stat-card card-hover text-left w-full cursor-pointer animate-slide-up stagger-${i + 1}
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
              ${isActive ? `ring-2 ring-offset-1 ${t.ring}` : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="stat-value">{t.value}</p>
                <p className="stat-label mt-1 truncate">{t.label}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${t.accent}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>{t.icon}</svg>
              </div>
            </div>
            <p className="text-[11px] font-medium text-navy-300 mt-2">
              {isActive ? 'Click to hide' : 'Click to view'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
