/**
 * Gate Pass Form — S4, FR-GP-04/06/07, PRD §4.3
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Department, GatePassDir, GatePassType, GatePassItem } from '../../types/index';

type ItemLine = Omit<GatePassItem, 'id' | 'gate_pass_id' | 'returned_qty'>;

export default function GatePassForm(): React.ReactElement {
  const nav = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [type, setType] = useState<GatePassType>('NRGP');
  const [direction, setDirection] = useState<GatePassDir>('OUT');
  const [deptId, setDeptId] = useState('');
  const [reason, setReason] = useState('');
  const [carrier, setCarrier] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<ItemLine[]>([{ description: '', qty: 1, unit: null, serial_no: null, approx_value: null }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { supabase.from('departments').select('*').order('name').then(({ data }) => setDepartments(data ?? [])); }, []);
  const updateItem = (idx: number, field: keyof ItemLine, value: string | number | null) => { setItems((items) => items.map((it, i) => i === idx ? { ...it, [field]: value } : it)); };
  const addItem = () => setItems((i) => [...i, { description: '', qty: 1, unit: null, serial_no: null, approx_value: null }]);
  const removeItem = (idx: number) => setItems((i) => i.filter((_, j) => j !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: gp, error: gpErr } = await supabase.from('gate_passes').insert({
        type, direction, department_id: deptId, reason, carrier_name: carrier || null,
        expected_return_date: type === 'RGP' ? dueDate || null : null, status: 'draft', created_by: user.id, visit_id: null,
      }).select().single();
      if (gpErr) throw gpErr;
      const { error: itemErr } = await supabase.from('gate_pass_items').insert(
        items.map((it) => ({ gate_pass_id: (gp as { id: string }).id, description: it.description, qty: it.qty, unit: it.unit, serial_no: it.serial_no, approx_value: it.approx_value, returned_qty: 0 })),
      );
      if (itemErr) throw itemErr;
      nav('/gate-passes');
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl card p-6 sm:p-8 space-y-6">
      <div><h2 className="text-lg font-bold text-navy-950">New Gate Pass</h2><p className="text-sm text-navy-400 mt-1">Create a material gate pass</p></div>

      <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2">
            {(['RGP', 'NRGP'] as GatePassType[]).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${type === t ? 'bg-navy-800 text-white shadow-sm' : 'bg-surface-50 text-navy-500 hover:bg-surface-100 border border-surface-200'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Direction</label>
          <div className="flex gap-2">
            {(['IN', 'OUT'] as GatePassDir[]).map((d) => (
              <button key={d} type="button" onClick={() => setDirection(d)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${direction === d ? 'bg-navy-800 text-white shadow-sm' : 'bg-surface-50 text-navy-500 hover:bg-surface-100 border border-surface-200'}`}>{d}</button>
            ))}
          </div>
        </div>
        <div><label className="label">Department *</label><select required value={deptId} onChange={(e) => setDeptId(e.target.value)} className="input"><option value="">Select department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        {type === 'RGP' && (<div><label className="label">Expected Return Date *</label><input type="date" required={type === 'RGP'} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" /></div>)}
        <div className="sm:col-span-2"><label className="label">Reason / Purpose *</label><input type="text" required value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Describe the purpose" /></div>
        <div className="sm:col-span-2"><label className="label">Carrier (Person / Vehicle)</label><input type="text" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="input" placeholder="Name or vehicle no." /></div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="section-title">Item Lines *</label>
          <button type="button" onClick={addItem} className="text-sm text-brand-700 hover:text-brand-800 font-medium transition-colors">+ Add item</button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="card p-3 grid grid-cols-12 gap-2 items-center text-sm">
              <input placeholder="Description" required value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} className="input col-span-5" />
              <input type="number" placeholder="Qty" required min={1} value={it.qty} onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))} className="input col-span-2" />
              <input placeholder="Serial no." value={it.serial_no ?? ''} onChange={(e) => updateItem(idx, 'serial_no', e.target.value || null)} className="input col-span-3" />
              <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="col-span-2 text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-30 transition-colors">Remove</button>
            </div>
          ))}
        </div>
      </div>

      {error && (<div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3"><p className="text-sm text-red-600">{error}</p></div>)}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => nav('/gate-passes')} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Saving...' : 'Create Draft'}</button>
      </div>
    </form>
  );
}
