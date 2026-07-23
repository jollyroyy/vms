import React, { useEffect, useState } from 'react';
import type { GatePass } from '../../types/index';
import { supabase } from '../../supabaseClient';

interface GateSignoffPanelProps {
  pass: GatePass;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function GateSignoffPanel({ pass, onClose, onUpdated }: GateSignoffPanelProps) {
  const [gateName, setGateName] = useState('Main Gate');
  const [verifiedQty, setVerifiedQty] = useState<Record<string, number>>({});
  const [verifiedVehicle, setVerifiedVehicle] = useState(pass.verified_vehicle || pass.carrier_name || '');
  const [remarks, setRemarks] = useState('');
  const [itemMatched, setItemMatched] = useState<Record<string, boolean>>({});
  const [qtyMatched, setQtyMatched] = useState<Record<string, boolean>>({});
  const [serialChecked, setSerialChecked] = useState<Record<string, boolean>>({});
  const [carrierChecked, setCarrierChecked] = useState(false);
  const [attachmentChecked, setAttachmentChecked] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [signedOff, setSignedOff] = useState(false);
  const [error, setError] = useState('');
  const [securityUser, setSecurityUser] = useState<{ name: string; id: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('full_name').eq('id', user.id).single().then(({ data }) => {
        if (data) {
          setSecurityUser({ name: (data as any).full_name || user.email || '', id: user.id });
        } else {
          setSecurityUser({ name: user.email || '', id: user.id });
        }
      });
    });

    const qtyMap: Record<string, number> = {};
    const matchMap: Record<string, boolean> = {};
    const serialMap: Record<string, boolean> = {};
    pass.items?.forEach((item) => {
      qtyMap[item.id] = item.qty;
      matchMap[item.id] = true;
      serialMap[item.id] = false;
    });
    setVerifiedQty(qtyMap);
    setItemMatched(matchMap);
    setQtyMatched(matchMap);
    setSerialChecked(serialMap);
  }, [pass]);

  const isRgp = pass.type === 'RGP';
  const isOutbound = pass.direction === 'OUT';
  const canMarkOut = pass.status === 'approved';
  const canMarkIn = pass.status === 'awaiting_return' || pass.status === 'partially_returned';
  const showActions = canMarkOut || canMarkIn;

  const allRequiredChecked =
    Object.values(itemMatched).every(Boolean) &&
    Object.values(qtyMatched).every(Boolean) &&
    (pass.items?.every((i) => !i.serial_no || serialChecked[i.id]) ?? true) &&
    carrierChecked;

  async function handleSignOff(action: 'out' | 'in' | 'hold' | 'mismatch') {
    setSigningOff(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('gate_signoffs').insert({
        gate_pass_id: pass.id,
        security_user_id: user.id,
        security_name: securityUser?.name || user.email || 'Unknown',
        security_employee_id: null,
        gate_name: gateName,
        action_type: action,
        action_timestamp: new Date().toISOString(),
        verified_qty: Object.values(verifiedQty).reduce((a, b) => a + b, 0) || null,
        verified_vehicle: verifiedVehicle || null,
        remarks: remarks || null,
        photo_url: null,
        device_info: { userAgent: navigator.userAgent },
        session_id: null,
      } as any);

      if (action === 'out') {
        const newStatus = pass.type === 'NRGP' ? 'closed' : 'awaiting_return';
        await supabase.from('gate_passes').update({
          status: newStatus,
          verified_vehicle: verifiedVehicle || null,
        }).eq('id', pass.id);
      } else if (action === 'in') {
        await supabase.from('gate_passes').update({
          status: 'returned',
          verified_vehicle: verifiedVehicle || null,
        }).eq('id', pass.id);
      }

      setSignedOff(true);
      setTimeout(() => { onUpdated?.(); onClose(); }, 2000);
    } catch (err: any) {
      setError(err.message || 'Sign-off failed');
    } finally {
      setSigningOff(false);
    }
  }

  const statusColors: Record<string, string> = {
    approved: 'bg-success-100 text-success-700',
    awaiting_return: 'bg-warning-100 text-warning-700',
    partially_returned: 'bg-warning-100 text-warning-700',
    closed: 'bg-surface-100 text-navy-500',
    returned: 'bg-info-100 text-info-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="card max-w-3xl mx-auto mt-8 mb-8 overflow-y-auto max-h-[90vh] p-0 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-surface-100 hover:bg-surface-200 text-navy-400 hover:text-navy-600 transition-colors z-10"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {signedOff ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-navy-900">Security Verified</p>
              <div className="mt-3 text-sm text-navy-600 space-y-1">
                <p>Verified by: {securityUser?.name || '—'}</p>
                <p>Role: Security Officer</p>
                <p>Gate: {gateName}</p>
                <p>Date/Time: {new Date().toLocaleString('en-IN')}</p>
                <p>Status: Material Released</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-surface-200">
            {/* Header */}
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold text-navy-900 tracking-tight">{pass.ref_number}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  isRgp ? 'bg-brand-100 text-brand-700' : 'bg-surface-100 text-navy-600'
                }`}>
                  {pass.type}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  pass.direction === 'OUT' ? 'bg-warning-100 text-warning-700' : 'bg-info-100 text-info-700'
                }`}>
                  {pass.direction}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${statusColors[pass.status] || 'bg-surface-100 text-navy-500'}`}>
                  {pass.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-navy-400 text-xs font-semibold uppercase tracking-wide">Department</span>
                  <p className="font-semibold text-navy-800">{pass.department?.name || '—'}</p>
                </div>
                <div>
                  <span className="text-navy-400 text-xs font-semibold uppercase tracking-wide">Requester</span>
                  <p className="font-semibold text-navy-800">{pass.created_by_profile?.full_name || '—'}</p>
                </div>
                <div>
                  <span className="text-navy-400 text-xs font-semibold uppercase tracking-wide">Carrier</span>
                  <p className="font-semibold text-navy-800">{pass.carrier_name || '—'}</p>
                </div>
                {pass.company_name && (
                  <div>
                    <span className="text-navy-400 text-xs font-semibold uppercase tracking-wide">Company</span>
                    <p className="font-semibold text-navy-800">{pass.company_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Item Checklist */}
            <div className="p-6 space-y-4">
              <h3 className="text-base font-bold text-navy-900">Verify Items at Gate</h3>
              <div className="space-y-3">
                {pass.items?.map((item) => (
                  <div key={item.id} className="bg-surface-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-navy-800 text-sm">{item.description}</p>
                        {item.serial_no && (
                          <p className="text-xs text-navy-400 mt-0.5 font-mono">S/N: {item.serial_no}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <label className="text-xs text-navy-500 font-medium">Qty:</label>
                        <input
                          type="number"
                          min={0}
                          value={verifiedQty[item.id] ?? item.qty}
                          onChange={(e) => setVerifiedQty((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                          className="w-16 px-2 py-1 text-sm text-center border border-surface-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={itemMatched[item.id] ?? false}
                          onChange={(e) => setItemMatched((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                          className="rounded border-surface-300 text-brand-600 focus:ring-brand-500/30"
                        />
                        <span className="text-navy-600">Item matched</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={qtyMatched[item.id] ?? false}
                          onChange={(e) => setQtyMatched((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                          className="rounded border-surface-300 text-brand-600 focus:ring-brand-500/30"
                        />
                        <span className="text-navy-600">Quantity matched</span>
                      </label>
                      {item.serial_no && (
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={serialChecked[item.id] ?? false}
                            onChange={(e) => setSerialChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                            className="rounded border-surface-300 text-brand-600 focus:ring-brand-500/30"
                          />
                          <span className="text-navy-600">Serial/asset tag checked</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
                {(!pass.items || pass.items.length === 0) && (
                  <p className="text-sm text-navy-400 italic">No items to verify</p>
                )}
              </div>
            </div>

            {/* Verification Section */}
            <div className="p-6 space-y-4">
              <h3 className="text-base font-bold text-navy-900">Verification</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Vehicle Number</label>
                  <input
                    type="text"
                    value={verifiedVehicle}
                    onChange={(e) => setVerifiedVehicle(e.target.value)}
                    placeholder="Enter vehicle number"
                    className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carrierChecked}
                      onChange={(e) => setCarrierChecked(e.target.checked)}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500/30"
                    />
                    <span className="text-navy-700 font-medium">Carrying person checked</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachmentChecked}
                      onChange={(e) => setAttachmentChecked(e.target.checked)}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500/30"
                    />
                    <span className="text-navy-700 font-medium">Attachment/challan checked</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="p-6 space-y-3">
              <h3 className="text-base font-bold text-navy-900">Remarks</h3>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any mismatch or notes..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-surface-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="px-6 pb-2">
                <p className="text-xs text-danger-600 font-medium">{error}</p>
              </div>
            )}

            {/* Actions */}
            {showActions && (
              <div className="p-6 flex flex-wrap items-center gap-3">
                {canMarkOut && (
                  <button
                    onClick={() => handleSignOff('out')}
                    disabled={!allRequiredChecked || signingOff}
                    className="btn-primary !bg-gradient-to-r !from-emerald-500 !to-emerald-600 !shadow-emerald-500/30"
                  >
                    {signingOff ? 'Signing Off...' : 'Mark Out'}
                  </button>
                )}
                {canMarkIn && (
                  <button
                    onClick={() => handleSignOff('in')}
                    disabled={!allRequiredChecked || signingOff}
                    className="btn-primary !bg-gradient-to-r !from-emerald-500 !to-emerald-600 !shadow-emerald-500/30"
                  >
                    {signingOff ? 'Signing Off...' : 'Mark In'}
                  </button>
                )}
                <button
                  onClick={() => handleSignOff('hold')}
                  disabled={!allRequiredChecked || signingOff}
                  className="btn-secondary !border-amber-300 !text-amber-700 !bg-amber-50 hover:!bg-amber-100"
                >
                  Hold
                </button>
                <button
                  onClick={() => handleSignOff('mismatch')}
                  disabled={signingOff}
                  className="btn-secondary !border-danger-300 !text-danger-600 !bg-danger-50 hover:!bg-danger-100"
                >
                  Mismatch
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
