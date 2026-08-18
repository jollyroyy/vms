// At-a-glance strip above the department list. Each tile is a button: clicking a
// count is the only way to reveal the records behind it, so the page opens as a
// summary and the admin drills in deliberately. Clicking the active tile again
// collapses the panel.
import React from 'react';
import type { AdminOverviewView } from './adminOverviewView';
import type { KpiTileSpec } from '../../components/KpiTile';
import KpiTile from '../../components/KpiTile';
import { glyph, USERS } from '../Guard/dashboardTiles';

type Props = {
  departmentCount: number;
  hodCount: number;
  unassignedCount: number;
  active: AdminOverviewView | null;
  onSelect: (view: AdminOverviewView) => void;
  panelId: string;
};

const BUILDING = ['M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21'];
const ALERT = ['M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'];

// Same card as every other count board in the app (KpiTile), with the same
// tone meanings: brand for the structure itself, accent for the people in it,
// amber for the gap that needs a decision.
const SPECS: Record<AdminOverviewView, KpiTileSpec> = {
  departments: {
    label: 'Departments', tone: 'text-brand-600 dark:text-brand-300',
    tint: 'var(--c-brand-100)', icon: glyph(...BUILDING),
  },
  hods: {
    label: 'Heads of Department', tone: 'text-accent-600 dark:text-accent-300',
    tint: '250 232 217', icon: glyph(...USERS),
  },
  unassigned: {
    label: 'Awaiting an HOD', tone: 'text-warning-600 dark:text-warning-500',
    tint: 'var(--c-warning-100)', icon: glyph(...ALERT),
  },
};

const ORDER: AdminOverviewView[] = ['departments', 'hods', 'unassigned'];

export default function AdminStats({
  departmentCount, hodCount, unassignedCount, active, onSelect, panelId,
}: Props): React.ReactElement {
  const values: Record<AdminOverviewView, number> = {
    departments: departmentCount,
    hods: hodCount,
    unassigned: unassignedCount,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ORDER.map((view, i) => {
        const isActive = active === view;
        return (
          <KpiTile
            key={view}
            spec={SPECS[view]}
            value={values[view]}
            loading={false}
            expanded={isActive}
            pressed={isActive}
            controlsId={panelId}
            index={i}
            caption={isActive ? 'Click to hide' : 'Click to view'}
            onDrill={() => onSelect(view)}
          />
        );
      })}
    </div>
  );
}