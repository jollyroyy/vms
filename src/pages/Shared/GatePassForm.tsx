import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { safeErrorMessage } from '../../lib/errors';
import type { GatePassDir, GatePassType, GatePassItem } from '../../types/index';
import SuccessPopup from '../../components/SuccessPopup';

type ItemLine = Omit<GatePassItem, 'id' | 'gate_pass_id' | 'returned_qty'>;

export default function GatePassForm(): React.ReactElement {
  const nav = useNavigate();
  const [type, setType] = useState<GatePassType>('NRGP');
  const [direction, setDirection] = useState<GatePassDir>('OUT');
  const [deptId, setDeptId] = useState('');
  const [reason, setReason] = useState('');
  const [carrier, setCarrier] = useState('');
  const [company, setCompany] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<ItemLine[]>([{ description: '', qty: 1, unit: null, serial_no: null, approx_value: null }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refNumber, setRefNumber] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const meta = data.user.app_metadata;
      const id = (meta?.department_id as string) ?? null;
      if (id) { setDeptId(id); return; }
      supabase.from('profiles').select('department_id').eq('id', data.user.id).single().then(({ data: p }) => {
        if (p?.department_id) setDeptId(p.department_id);
      });
    });
  }, []);
  const updateItem = (idx: number, field: keyof ItemLine, value: string | number | null) => { setItems((items) => items.map((it, i) => i === idx ? { ...it, [field]: value } : it)); };
  const addItem = () => setItems((i) => [...i, { description: '', qty: 1, unit: null, serial_no: null, approx_value: null }]);
  const removeItem = (idx: number) => setItems((i) => i.filter((_, j) => j !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: gp, error: gpErr } = await supabase.from('gate_passes').insert({
        type, direction, department_id: deptId, reason, carrier_name: carrier || null, company_name: company || null,
        expected_return_date: type === 'RGP' && direction === 'OUT' ? dueDate || null : null, status: 'draft', created_by: user.id, visit_id: null, verified_vehicle: null,
      }).select().single();
      if (gpErr) throw gpErr;
      const { error: itemErr } = await supabase.from('gate_pass_items').insert(
        items.map((it) => ({ gate_pass_id: (gp as { id: string }).id, description: it.description, qty: it.qty, unit: it.unit, serial_no: it.serial_no, approx_value: it.approx_value, returned_qty: 0 })),
      );
      if (itemErr) throw itemErr;
      setRefNumber((gp as { ref_number: string }).ref_number);
    } catch (err) { setError(safeErrorMessage(err, 'Failed to create gate pass.')); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl card-premium p-6 sm:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3.5">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
          <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
        </div>
        <div>
          <h2 className="page-title">New Gate Pass</h2>
          <p className="page-subtitle">Create a material gate pass</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2">
            {(['RGP', 'NRGP'] as GatePassType[]).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${type === t ? 'bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-glow-sm ring-1 ring-white/20' : 'bg-surface-100 text-navy-500 hover:bg-surface-200 border border-surface-200/60'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Direction</label>
          <div className="flex gap-2">
            {(['IN', 'OUT'] as GatePassDir[]).map((d) => (
              <button key={d} type="button" onClick={() => setDirection(d)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${direction === d ? 'bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-glow-sm ring-1 ring-white/20' : 'bg-surface-100 text-navy-500 hover:bg-surface-200 border border-surface-200/60'}`}>{d}</button>
            ))}
          </div>
        </div>
        {type === 'RGP' && direction === 'OUT' && (<div><label className="label">Expected Return Date *</label><input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="input" /></div>)}
        <div className="sm:col-span-2"><label className="label">Reason / Purpose *</label><input type="text" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Describe the purpose" /></div>
        <div><label className="label">Carrier (Person / Vehicle)</label><input type="text" maxLength={100} value={carrier} onChange={(e) => setCarrier(e.target.value)} className="input" placeholder="Name or vehicle no." /></div>
        <div><label className="label">Company / Vendor</label><input type="text" maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} className="input" placeholder="Company or vendor name" /></div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="section-title">Item Lines *</label>
          <button type="button" onClick={addItem} className="text-sm text-brand-600 hover:text-brand-500 font-medium transition-colors">+ Add item</button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="card p-3 grid grid-cols-12 gap-2 items-center text-sm">
              <input placeholder="Description" required maxLength={200} value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} className="input col-span-5" />
              <input type="number" placeholder="Qty" required min={1} max={99999} value={it.qty} onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))} className="input col-span-2" />
              <input placeholder="Serial no." maxLength={100} value={it.serial_no ?? ''} onChange={(e) => updateItem(idx, 'serial_no', e.target.value || null)} className="input col-span-3" />
              <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="col-span-2 text-danger-600 hover:text-danger-500 text-xs font-medium disabled:opacity-30 transition-colors">Remove</button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert-error">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {error}
        </div>
      )}
      {refNumber && (
        <SuccessPopup
          title="Gate Pass Created"
          message={`Gate pass ${refNumber} has been created successfully. It is now in Draft status and pending HOD approval.`}
          onClose={() => nav('/gate-passes')}
        />
      )}
      <div className="flex gap-3 pt-5 border-t border-surface-200/60 dark:border-white/[0.06]">
        <button type="button" onClick={() => nav('/gate-passes')} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Saving...' : 'Create Draft'}</button>
      </div>
    </form>
  );
}
