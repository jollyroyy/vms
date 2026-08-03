import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizePhone, isBlacklisted } from '../../lib/blacklist';
import { safeErrorMessage } from '../../lib/errors';
import { findActiveVisitByPhone, activeVisitMessage, isAlreadyInsideError, ALREADY_INSIDE_FALLBACK } from '../../lib/activeVisit';
import { useDepartments } from '../../lib/useDepartments';
import type { Profile, Visit, VisitorPurpose } from '../../types/index';
import KioskIdleScreen from './KioskIdleScreen';
import KioskPhoneScreen from './KioskPhoneScreen';
import KioskFormScreen from './KioskFormScreen';
import KioskBadgeScreen from './KioskBadgeScreen';
import { useKioskAutoReset } from './useKioskAutoReset';

type Step = 'idle' | 'phone' | 'form' | 'badge';

export default function Kiosk(): React.ReactElement {
  const [step, setStep] = useState<Step>('idle');

  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [purpose, setPurpose] = useState<VisitorPurpose>('meeting');
  const [deptId, setDeptId] = useState('');
  const [hostId, setHostId] = useState('');
  const { departments } = useDepartments();
  const [hosts, setHosts] = useState<Profile[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [recalledName, setRecalledName] = useState<string | null>(null);
  const [blacklist, setBlacklist] = useState<{ phone: string; reason: string }[]>([]);
  const [blacklistHit, setBlacklistHit] = useState<string | null>(null);
  const [preApprovedVisit, setPreApprovedVisit] = useState<{ id: string; ref_number: string; visitor_name: string; dept_name: string; purpose: string; photo_data: string | null } | null>(null);
  const [checkingInPreApproved, setCheckingInPreApproved] = useState(false);
  const [badgeVisit, setBadgeVisit] = useState<Visit | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);

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

  const resetAll = useCallback(() => {
    setStep('idle');
    setPhone('');
    setFullName('');
    setVendorName('');
    setPurpose('meeting');
    setDeptId('');
    setHostId('');
    setPhotoBlob(null);
    setError('');
    setSuccessMsg('');
    setRecalledName(null);
    setBlacklistHit(null);
    setPreApprovedVisit(null);
    setBadgeVisit(null);
    setHostError(null);
    setSubmitting(false);
    setCheckingInPreApproved(false);
  }, []);

  const {
    resetCountdown, startIdleTimer, clearIdleTimer, startBadgeCountdown,
  } = useKioskAutoReset(resetAll);

  const showBadgeWithCountdown = useCallback((visit: Visit) => {
    setBadgeVisit(visit);
    setStep('badge');
    startBadgeCountdown();
  }, [startBadgeCountdown]);

  const recallByPhone = useCallback(async (): Promise<'blacklisted' | 'pre-approved' | 'found' | 'not-found'> => {
    if (!phone) return 'not-found';
    let normalized: string;
    try { normalized = normalizePhone(phone); } catch { return 'not-found'; }
    const hit = isBlacklisted(phone, blacklist);
    if (hit) { setBlacklistHit(hit.reason); return 'blacklisted'; }
    setBlacklistHit(null);
    setPreApprovedVisit(null);
    const { data } = await supabase.from('visitors').select('*').eq('phone', normalized).maybeSingle();
    if (!data) { setFullName(''); setVendorName(''); setRecalledName(null); return 'not-found'; }
    const v = data as any;
    setFullName(v.full_name); setVendorName(v.vendor_name ?? ''); setRecalledName(v.full_name);
    const { data: pre } = await (supabase as any)
      .from('visits')
      .select('id, ref_number, purpose, photo_data, department:departments(name)')
      .eq('visitor_id', v.id)
      .in('status', ['approved', 'walkin_approved'])
      .maybeSingle();
    if (pre) {
      setPreApprovedVisit({
        id: pre.id, ref_number: pre.ref_number, visitor_name: v.full_name,
        dept_name: pre.department?.name ?? '', purpose: pre.purpose, photo_data: pre.photo_data,
      });
      return 'pre-approved';
    }
    return 'found';
  }, [phone, blacklist]);

  const handlePhoneSubmit = async () => {
    if (!phone) return;
    const result = await recallByPhone();
    if (result === 'pre-approved' || result === 'blacklisted') return;
    setStep('form');
  };

  const checkInPreApproved = async () => {
    if (!preApprovedVisit) return;
    setCheckingInPreApproved(true);
    setError('');
    try {
      // The kiosk is unattended, so it is the easiest place for someone already
      // inside to walk up and check in a second time. Migration 060 is the
      // backstop; this is the message the visitor actually reads.
      const clash = await findActiveVisitByPhone(phone);
      if (clash) { setError(activeVisitMessage(clash)); setCheckingInPreApproved(false); return; }

      const { error: err } = await supabase.from('visits').update({
        status: 'checked_in', checked_in_at: new Date().toISOString(),
      }).eq('id', preApprovedVisit.id);
      if (err) throw err;
      const { data: fullVisit } = await (supabase as any)
        .from('visits')
        .select('*, visitor:visitors(*), department:departments(id, name, code, created_at)')
        .eq('id', preApprovedVisit.id)
        .single();
      if (fullVisit) {
        const v = { ...fullVisit, photo_url: fullVisit.photo_data ?? undefined } as Visit;
        showBadgeWithCountdown(v);
      }
    } catch (err) {
      setError(isAlreadyInsideError(err)
        ? ALREADY_INSIDE_FALLBACK
        : safeErrorMessage(err, 'Failed to check in pre-approved visitor.'));
    }
    finally { setCheckingInPreApproved(false); }
  };

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
      console.warn('[kiosk] Storage upload failed, using base64 only:', uploadErr.message);
      return { photoPath: null, photoData: base64 };
    }
    const { data: urlData } = await supabase.storage
      .from('visitor-photos')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);
    return { photoPath: filePath, photoData: urlData?.signedUrl ?? base64 };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blacklistHit) { setError('Access denied — blacklisted phone.'); return; }
    if (!photoBlob) { setError('Photo is required.'); return; }
    setSubmitting(true); setError('');
    try {
      let normalized: string;
      try { normalized = normalizePhone(phone); } catch { throw new Error('Enter a valid 10-digit mobile number.'); }
      const { data: existingVisit } = await (supabase as any)
        .rpc('get_active_visit_for_phone', { p_phone: normalized });
      if (existingVisit) {
        setError(`This phone has an active visit (Ref: ${existingVisit.ref_number}).`);
        setSubmitting(false); return;
      }
      const { data: vis, error: visErr } = await supabase.from('visitors').upsert(
        { phone: normalized, full_name: fullName, vendor_name: vendorName || null },
        { onConflict: 'phone' },
      ).select().single();
      if (visErr) throw visErr;
      if (!vis) throw new Error('Failed to create visitor record.');
      const { photoPath, photoData } = await uploadPhoto(photoBlob);
      const { error: visitErr } = await supabase.from('visits').insert({
        visitor_id: vis.id, department_id: deptId, host_id: hostId, purpose,
        photo_path: photoPath, photo_data: photoData,
        status: 'pending_approval', carrying_material: false,
        scheduled_for: null,
        checked_in_at: null, checked_out_at: null, exit_verified: null, rejection_reason: null,
      });
      if (visitErr) throw visitErr;
      setSuccessMsg(`Registration submitted — awaiting HOD approval.`);
      setStep('badge');
      // Shorter than the badge screen's 15s: there is no pass to read here,
      // only a "submitted, awaiting approval" acknowledgement.
      startBadgeCountdown(12);
    } catch (err) { setError(safeErrorMessage(err, 'Registration failed.')); }
    finally { setSubmitting(false); }
  };

  const renderContent = () => {
    switch (step) {
      case 'idle':
        return <KioskIdleScreen onStart={() => { clearIdleTimer(); setStep('phone'); }} />;
      case 'phone':
        return (
          <KioskPhoneScreen
            phone={phone}
            onPhoneChange={(v) => { setPhone(v); setRecalledName(null); setBlacklistHit(null); setPreApprovedVisit(null); }}
            onPhoneKeyDown={(e) => { if (e.key === 'Enter') handlePhoneSubmit(); if (e.key === 'Escape') resetAll(); }}
            onBack={() => resetAll()}
            onSubmit={handlePhoneSubmit}
            recalledName={recalledName}
            blacklistHit={blacklistHit}
            preApprovedVisit={preApprovedVisit}
            checkingInPreApproved={checkingInPreApproved}
            onCheckInPreApproved={checkInPreApproved}
            error={error}
          />
        );
      case 'form':
        return (
          <KioskFormScreen
            error={error}
            onSubmit={handleSubmit}
            onBack={() => { setStep('phone'); setError(''); }}
            phone={phone}
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
            photoBlob={photoBlob}
            onPhotoCapture={(blob) => setPhotoBlob(blob)}
            onRetakePhoto={() => setPhotoBlob(null)}
            submitting={submitting}
          />
        );
      case 'badge':
        return <KioskBadgeScreen badgeVisit={badgeVisit} successMsg={successMsg} resetCountdown={resetCountdown} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-50 overflow-y-auto" onClick={() => { if (step !== 'idle') startIdleTimer(); }}>
      {renderContent()}
    </div>
  );
}
