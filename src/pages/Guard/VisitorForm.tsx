/**
 * VisitorForm — FR-VIS-02/03, PRD §3.4
 */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import { findActiveVisitByPhone, activeVisitMessage, isAlreadyInsideError, ALREADY_INSIDE_FALLBACK } from '../../lib/activeVisit';
import { useDepartments } from '../../lib/useDepartments';
import type { Profile, Visitor, VisitorPurpose } from '../../types/index';
import VisitorFormAlerts from './VisitorFormAlerts';
import VisitorFormPreApproved from './VisitorFormPreApproved';
import VisitorFormFields from './VisitorFormFields';
import IdScanOverlay, { type IdScanResult } from './IdScanOverlay';
import { isFeatureEnabled } from '../../lib/featureFlags';

type Props = { onRegistered: (visitorName: string) => void };

export default function VisitorForm({ onRegistered }: Props): React.ReactElement {
  const { departments } = useDepartments();
  const [hosts,       setHosts]       = useState<Profile[]>([]);
  const [blacklist,   setBlacklist]   = useState<{ phone: string; reason: string }[]>([]);

  const [phone,       setPhone]       = useState('');
  const [fullName,    setFullName]    = useState('');
  const [vendorName,  setVendorName]  = useState('');
  const [purpose,     setPurpose]     = useState<VisitorPurpose>('meeting');
  const [deptId,      setDeptId]      = useState('');
  const [hostId,      setHostId]      = useState('');
  const [idType,      setIdType]      = useState('');
  const [idLast4,     setIdLast4]     = useState('');
  const [vehicle,     setVehicle]     = useState('');
  const [carryingMaterial, setCarryingMaterial] = useState(false);
  const [photoBlob,   setPhotoBlob]   = useState<Blob | null>(null);
  const [scanOpen,    setScanOpen]    = useState(false);

  const [blacklistHit,  setBlacklistHit]  = useState<string | null>(null);
  const [recalledName,  setRecalledName]  = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [hostError,     setHostError]     = useState<string | null>(null);
  const [activeVisitCheck, setActiveVisitCheck] = useState<{ checking: boolean; message: string | null }>({ checking: false, message: null });
  const [preApprovedVisit, setPreApprovedVisit] = useState<{ id: string; ref_number: string; visitor_name: string; dept_name: string; purpose: string; photo_data: string | null } | null>(null);
  const [checkingInPreApproved, setCheckingInPreApproved] = useState(false);

  useEffect(() => {
    supabase.from('visitors').select('phone, blacklist_reason').eq('is_blacklisted', true).then(({ data }) => {
      setBlacklist((data ?? []).map((r) => ({ phone: r.phone, reason: r.blacklist_reason ?? 'Flagged' })));
    });
  }, []);

  const loadHosts = useCallback(async (departmentId: string) => {
    setHostError(null);
    try {
      const { data, error } = await (supabase as any).rpc('get_hosts_for_department', { dept_id: departmentId });
      if (error) throw error;
      setHosts((data ?? []) as Profile[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load hosts:', msg);
      setHostError('Could not load person-to-meet list.');
      setHosts([]);
    }
  }, []);

  useEffect(() => {
    if (!deptId) { setHosts([]); setHostError(null); return; }
    void loadHosts(deptId);
  }, [deptId, loadHosts]);

  const recallByPhone = useCallback(async () => {
    if (!phone) return;
    let normalized: string;
    try { normalized = normalizePhone(phone); } catch { return; }
    const hit = isBlacklisted(phone, blacklist);
    if (hit) { setBlacklistHit(hit.reason); return; }
    setBlacklistHit(null);
    setPreApprovedVisit(null);
    const { data } = await supabase.from('visitors').select('*').eq('phone', normalized).maybeSingle();
    if (data) {
      const v = data as Visitor;
      setFullName(v.full_name); setVendorName(v.vendor_name ?? ''); setRecalledName(v.full_name);
      const pre = await (async () => {
        try {
          const { data: d } = await (supabase as any)
            .from('visits')
            .select('id, ref_number, purpose, photo_data, department:departments(name)')
            .eq('visitor_id', v.id)
            .eq('status', 'approved')
            .maybeSingle();
          return d as { id: string; ref_number: string; purpose: string; photo_data: string | null; department: { name: string } | null } | null;
        } catch { return null; }
      })();
      if (pre) {
        setPreApprovedVisit({
          id: pre.id,
          ref_number: pre.ref_number,
          visitor_name: v.full_name,
          dept_name: pre.department?.name ?? '',
          purpose: pre.purpose,
          photo_data: pre.photo_data,
        });
      }
    }
  }, [phone, blacklist]);

  const uploadPhoto = useCallback(async (blob: Blob): Promise<{ photoPath: string | null; photoData: string | null }> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read photo'));
      reader.readAsDataURL(blob);
    });

    const filePath = `visits/${Date.now()}.webp`;
    const { error: uploadErr } = await supabase.storage
      .from('visitor-photos')
      .upload(filePath, blob, { contentType: 'image/webp', upsert: true });

    if (uploadErr) {
      console.warn('[photo] Storage upload failed, using base64 only:', uploadErr.message);
      return { photoPath: null, photoData: base64 };
    }

    const { data: urlData } = await supabase.storage
      .from('visitor-photos')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    return { photoPath: filePath, photoData: urlData?.signedUrl ?? base64 };
  }, []);

  const applyScanResult = useCallback((r: IdScanResult) => {
    if (r.idType) setIdType(r.idType);
    if (r.idLast4) setIdLast4(r.idLast4);
    if (r.name && !fullName.trim()) setFullName(r.name);
    setScanOpen(false);
  }, [fullName]);

  const checkInPreApproved = async () => {
    if (!preApprovedVisit) return;
    setCheckingInPreApproved(true);
    setError('');
    try {
      // Holding a pre-approval is not a licence to be inside twice. The
      // registration path below already blocks this via SEC-17; this path skips
      // that form entirely, so it needs its own check. Migration 060 is the
      // backstop if two devices race.
      const clash = await findActiveVisitByPhone(phone);
      if (clash) { setError(activeVisitMessage(clash)); setCheckingInPreApproved(false); return; }

      const { error: err } = await supabase.from('visits').update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
      }).eq('id', preApprovedVisit.id);
      if (err) throw err;
      setPreApprovedVisit(null);
      setPhone(''); setFullName(''); setVendorName(''); setRecalledName(null);
      onRegistered(preApprovedVisit.visitor_name);
    } catch (err) {
      setError(isAlreadyInsideError(err)
        ? ALREADY_INSIDE_FALLBACK
        : safeErrorMessage(err, 'Failed to check in pre-approved visitor.'));
    }
    finally { setCheckingInPreApproved(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blacklistHit) return;
    if (!photoBlob) { setError('Photo is required (FR-CAM-05).'); return; }
    setSubmitting(true); setError('');
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Please enter a valid 10-digit mobile number (e.g. +91 98765 43210).'); }
      // SEC-17: Check for existing active visit before registration
      setActiveVisitCheck({ checking: true, message: null });
      const { data: existingVisit } = await (supabase as any)
        .rpc('get_active_visit_for_phone', { p_phone: normalized });
      if (existingVisit) {
        setActiveVisitCheck({ checking: false, message: `This phone number already has an active visit (Ref: ${existingVisit.ref_number}, Status: ${existingVisit.status.replace(/_/g, ' ')}). Please complete that visit first.` });
        setSubmitting(false);
        return;
      }
      setActiveVisitCheck({ checking: false, message: null });
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, vendor_name: vendorName || null, id_type: idType || null, id_last4: idLast4 || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create/find visitor record.');
      if (vehicle.trim()) {
        await supabase.from('visitors').update({ vehicle_number: vehicle.trim() || null }).eq('id', vis.id);
      }
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        photo_path: photoPath, photo_data: photoData,
        status: 'pending_approval', carrying_material: carryingMaterial,
        scheduled_for: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      });
      if (visitErr) throw visitErr;
      onRegistered(fullName);
    } catch (err) { setError(safeErrorMessage(err, 'Registration failed. Please try again.')); }
    finally { setSubmitting(false); }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-navy-950">Register New Visitor</h2>
        <p className="text-sm text-navy-400 mt-1">
          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {new Date().toLocaleDateString('en-IN')}
        </p>
      </div>

      <VisitorFormAlerts
        blacklistHit={blacklistHit}
        recalledName={recalledName}
        hasPreApprovedVisit={!!preApprovedVisit}
        error={error}
        activeVisitCheck={activeVisitCheck}
        onDismissActiveVisitCheck={() => setActiveVisitCheck({ checking: false, message: null })}
      />

      {preApprovedVisit && (
        <VisitorFormPreApproved
          preApprovedVisit={preApprovedVisit}
          checkingInPreApproved={checkingInPreApproved}
          onCheckIn={checkInPreApproved}
          onRegisterWalkIn={() => setPreApprovedVisit(null)}
        />
      )}

      {!preApprovedVisit && (
        <VisitorFormFields
          phone={phone}
          onPhoneChange={(v) => { setPhone(v); setRecalledName(null); setBlacklistHit(null); }}
          onPhoneBlur={recallByPhone}
          fullName={fullName}
          onFullNameChange={setFullName}
          vendorName={vendorName}
          onVendorNameChange={setVendorName}
          purpose={purpose}
          onPurposeChange={setPurpose}
          deptId={deptId}
          onDeptChange={setDeptId}
          departments={departments}
          hostId={hostId}
          onHostChange={setHostId}
          hosts={hosts}
          hostError={hostError}
          onRetryHosts={() => void loadHosts(deptId)}
          idType={idType}
          onIdTypeChange={setIdType}
          idLast4={idLast4}
          onIdLast4Change={setIdLast4}
          onScanId={isFeatureEnabled('ocr') ? () => setScanOpen(true) : undefined}
          vehicle={vehicle}
          onVehicleChange={setVehicle}
          carryingMaterial={carryingMaterial}
          onCarryingMaterialChange={setCarryingMaterial}
          photoBlob={photoBlob}
          onPhotoCapture={(blob) => setPhotoBlob(blob)}
          onRetakePhoto={() => setPhotoBlob(null)}
          submitting={submitting}
          blacklistHit={blacklistHit}
          activeVisitChecking={activeVisitCheck.checking}
        />
      )}
    </form>
    {scanOpen && (
      <IdScanOverlay
        onScanned={applyScanResult}
        onClose={() => setScanOpen(false)}
      />
    )}
    </>
  );
}
