import React, { useState } from 'react';
import type { DailyVisitor, DailyVisitorType } from './DailyVisitorTypes';
import { TYPE_META } from './DailyVisitorTypes';

export default function AddNewForm({
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
