import React, { useMemo, useState } from 'react';
import type { DailyVisitor, DailyVisitorType } from './DailyVisitorTypes';
export type { DailyVisitor, DailyVisitorType };
import VisitorCard from './DailyVisitorCard';
import AddNewForm from './DailyVisitorAddForm';

type Tab = 'active_today' | 'all' | 'add_new';

type Props = {
  visitors: DailyVisitor[];
  onAdd: (visitor: Omit<DailyVisitor, 'id' | 'last_visit_date' | 'is_active' | 'checked_in_today'>) => void;
  onRemove: (id: string) => void;
};

export default function DailyVisitors({ visitors, onAdd, onRemove }: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('active_today');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DailyVisitorType | 'all'>('all');

  const stats = useMemo(() => {
    const total = visitors.length;
    const checkedIn = visitors.filter((v) => v.checked_in_today).length;
    const pending = visitors.filter((v) => v.is_active && !v.checked_in_today).length;
    return { total, checkedIn, pending };
  }, [visitors]);

  const filtered = useMemo(() => {
    let list = visitors;
    if (activeTab === 'active_today') list = list.filter((v) => v.is_active);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.full_name.toLowerCase().includes(q) ||
          v.department.toLowerCase().includes(q) ||
          v.phone.includes(q)
      );
    }
    if (typeFilter !== 'all') list = list.filter((v) => v.type === typeFilter);
    return list;
  }, [visitors, activeTab, search, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Daily Visitors</h1>
        <p className="page-subtitle">Manage recurring maids, workers &amp; vendors</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="stat-label">Total Active</p>
          <p className="stat-value">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Checked In Today</p>
          <p className="stat-value text-success-600">{stats.checkedIn}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pending</p>
          <p className="stat-value text-warning-600">{stats.pending}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="tab-group">
          <button
            onClick={() => setActiveTab('active_today')}
            className={activeTab === 'active_today' ? 'tab-active' : 'tab-inactive'}
          >
            Active Today
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={activeTab === 'all' ? 'tab-active' : 'tab-inactive'}
          >
            All Daily Visitors
          </button>
          <button
            onClick={() => setActiveTab('add_new')}
            className={activeTab === 'add_new' ? 'tab-active' : 'tab-inactive'}
          >
            Add New
          </button>
        </div>

        {activeTab !== 'add_new' && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search visitors..."
                className="input pl-9 w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-auto pr-8"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DailyVisitorType | 'all')}
            >
              <option value="all">All Types</option>
              <option value="maid">Maid</option>
              <option value="worker">Worker</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'add_new' ? (
        <AddNewForm
          onSubmit={onAdd}
          onCancel={() => setActiveTab('active_today')}
        />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 015 17.119V5a2 2 0 012-2h6" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-navy-600">No visitors found</p>
          <p className="text-xs text-navy-500 dark:text-navy-400 mt-1">
            {search ? 'Try a different search term' : 'Add your first daily visitor to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <VisitorCard key={v.id} visitor={v} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
