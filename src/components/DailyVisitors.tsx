import React, { useMemo, useState } from 'react';

export type DailyVisitorType = 'maid' | 'worker' | 'vendor';

export type DailyVisitor = {
  id: string;
  full_name: string;
  type: DailyVisitorType;
  department: string;
  phone: string;
  photo_url: string | null;
  last_visit_date: string | null;
  is_active: boolean;
  checked_in_today: boolean;
};

type Tab = 'active_today' | 'all' | 'add_new';

type Props = {
  visitors: DailyVisitor[];
  onAdd: (visitor: Omit<DailyVisitor, 'id' | 'last_visit_date' | 'is_active' | 'checked_in_today'>) => void;
  onRemove: (id: string) => void;
};

const TYPE_META: Record<DailyVisitorType, { label: string; color: string; bg: string }> = {
  maid:    { label: 'Maid',    color: 'text-accent-600',  bg: 'bg-accent-50 border-accent-200/60' },
  worker:  { label: 'Worker',  color: 'text-brand-600',   bg: 'bg-brand-50 border-brand-200/60' },
  vendor:  { label: 'Vendor',  color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200/60' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function VisitorCard({
  visitor,
  onRemove,
}: {
  visitor: DailyVisitor;
  onRemove: (id: string) => void;
}) {
  const meta = TYPE_META[visitor.type];

  return (
    <div className="card-hover p-5 group relative">
      <div className="flex items-start gap-4">
        {visitor.photo_url ? (
          <img
            src={visitor.photo_url}
            alt={visitor.full_name}
            className="h-12 w-12 rounded-2xl object-cover shrink-0 ring-2 ring-white/60 dark:ring-white/10"
          />
        ) : (
          <div className="h-12 w-12 rounded-2xl avatar-gradient flex items-center justify-center text-sm font-bold shrink-0">
            {getInitials(visitor.full_name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-navy-900 truncate">{visitor.full_name}</p>
            {visitor.checked_in_today && (
              <span className="status-badge bg-success-50 text-success-700 border border-success-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse-soft" />
                In
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <span className={`status-badge ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-xs text-navy-400">{visitor.department}</span>
          </div>

          <div className="flex items-center gap-3 mt-2.5 text-xs text-navy-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {formatDate(visitor.last_visit_date)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {visitor.phone}
            </span>
          </div>
        </div>

        <button
          onClick={() => onRemove(visitor.id)}
          className="opacity-0 group-hover:opacity-100 absolute top-3 right-3 btn-icon h-7 w-7 text-navy-300 hover:text-danger-500 hover:bg-danger-50 transition-all duration-200"
          title={`Remove ${visitor.full_name}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function AddNewForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: Omit<DailyVisitor, 'id' | 'last_visit_date' | 'is_active' | 'checked_in_today'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DailyVisitorType>('maid');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim() || !phone.trim()) return;
    onSubmit({ full_name: name.trim(), type, department: department.trim(), phone: phone.trim(), photo_url: null });
    setName('');
    setType('maid');
    setDepartment('');
    setPhone('');
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
          <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-navy-900">Add Daily Visitor</h3>
          <p className="text-xs text-navy-400">Register a new recurring visitor</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="label">Full Name</label>
        <input
          type="text"
          className="input"
          placeholder="e.g. Sunita Devi"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="label">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TYPE_META) as DailyVisitorType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold border transition-all duration-200 ${
                type === t
                  ? 'bg-brand-50 border-brand-300 text-brand-700 ring-2 ring-brand-500/20'
                  : 'bg-white border-surface-200 text-navy-500 hover:border-surface-300 hover:bg-surface-50'
              }`}
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="label">Department</label>
        <input
          type="text"
          className="input"
          placeholder="e.g. Housekeeping"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="label">Phone</label>
        <input
          type="tel"
          className="input"
          placeholder="e.g. 9876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1">
          Add Visitor
        </button>
      </div>
    </form>
  );
}

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
          <p className="text-xs text-navy-400 mt-1">
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
