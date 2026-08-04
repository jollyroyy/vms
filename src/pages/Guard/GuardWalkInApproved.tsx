// The other half of the walk-in lane: requests the host has now said yes to.
//
// Without this tab an approved walk-in had nowhere to go. CheckInPanel — the
// only other way into `checked_in` from the guard surface — moved to
// /guard/pre-approvals, and it searches pre-approvals, so a visitor who was
// never booked could be approved and then never checked in. This is their gate.
//
// A photo is taken here rather than at registration because at registration
// nobody knows yet whether the visitor is coming in: WalkInRequest deliberately
// inserts photo_path/photo_data as null. Capturing it at the moment of entry is
// also what the pre-approved lane does, so every checked-in visit carries a
// photo taken at the gate, however the visitor got approved.
import React, { useState } from 'react';
import type { Visit } from '../../types/index';
import VisitorCard from './VisitorCard';
import PhotoCapture from '../../components/PhotoCapture';
import { formatDateTime } from '../../lib/formatDate';

export type WalkInCheckIn = { photoBlob: Blob; carrying: boolean; remarks: string };

type Props = {
  loading: boolean;
  /** Walk-ins the host approved, not yet at the gate. */
  approved: Visit[];
  busyId: string | null;
  onCheckIn: (visit: Visit, details: WalkInCheckIn) => void;
};

export default function GuardWalkInApproved({ loading, approved, busyId, onCheckIn }: Props): React.ReactElement {
  const [openId, setOpenId] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [remarks, setRemarks] = useState('');

  const reset = () => { setOpenId(null); setPhotoBlob(null); setCarrying(false); setRemarks(''); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="gate-section-title">Approved, waiting to enter</h2>
        <span className="glass-chip !py-1 tabular-nums">{approved.length}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />)}
        </div>
      ) : approved.length === 0 ? (
        <div className="card empty-state !py-14">
          <p className="text-sm font-semibold text-navy-500">No approved walk-ins waiting.</p>
          <p className="text-xs text-navy-400 mt-1">
            Once a host approves a walk-in, they appear here ready to check in.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {approved.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
              <VisitorCard
                visit={v}
                timeLabel={formatDateTime(v.created_at)}
                action={openId === v.id ? undefined : { label: 'Check In', onClick: () => { reset(); setOpenId(v.id); } }}
              />

              {openId === v.id && (
                <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-5 mt-2 shadow-sm border border-surface-100 dark:border-white/[0.07] space-y-4">
                  <p className="text-sm font-semibold text-navy-700">Take a photo to check in</p>
                  <PhotoCapture onCapture={setPhotoBlob} />

                  {/* A tick box, never inferred from whether remarks were typed —
                      an empty box must mean "carrying nothing", not "the guard
                      was interrupted". Unticking discards the text so no orphaned
                      description survives on a visit flagged as carrying nothing. */}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carrying}
                      onChange={(e) => { setCarrying(e.target.checked); if (!e.target.checked) setRemarks(''); }}
                      className="h-4 w-4 rounded accent-brand-500"
                    />
                    <span className="text-sm font-semibold text-navy-700">Carrying material</span>
                  </label>
                  {carrying && (
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="What are they carrying?"
                      className="input"
                    />
                  )}

                  <div className="flex gap-2.5">
                    <button type="button" onClick={reset}
                      className="flex-1 rounded-xl border border-surface-200 bg-surface-50 text-navy-500 hover:bg-surface-100 py-2.5 text-sm font-semibold transition-all">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!photoBlob || busyId === v.id}
                      onClick={() => { if (photoBlob) { onCheckIn(v, { photoBlob, carrying, remarks }); reset(); } }}
                      className="btn-accent flex-1 !py-2.5 disabled:opacity-50"
                    >
                      {busyId === v.id ? 'Checking in…' : 'Confirm Check In'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
