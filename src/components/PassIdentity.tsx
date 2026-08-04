// Visitor identity block for entry pass — photo, name, vendor, and redacted ID
// proof. Purely presentational: rendered by PreApprovalPass (on-screen pass preview)
// and by the guard's post-scan summary. No data fetching, no supabase, no hooks.
import React from 'react';
import { maskIdProof } from '../lib/pii';

export type PassIdentityProps = {
  photoUrl?: string | null;
  name: string;
  vendorName?: string | null;
  idType?: string | null;
  idLast4?: string | null;
  /** 'lg' for the pass preview, 'sm' for the compact guard summary. Default 'lg'. */
  size?: 'sm' | 'lg';
  /** Whether to show the redacted ID Proof row. Defaults to true — the guard's
   * post-scan summary still needs it to check a document against the person
   * at the gate. Callers that hand this pass to an approver instead (never at
   * the gate) turn it off. */
  showIdProof?: boolean;
};

export default function PassIdentity({
  photoUrl,
  name,
  vendorName,
  idType,
  idLast4,
  size = 'lg',
  showIdProof = true,
}: PassIdentityProps): React.ReactElement {
  const isLarge = size === 'lg';
  const photoSize = isLarge ? 'w-20 h-24' : 'w-14 h-[72px]';

  return (
    <div className="flex gap-4">
      {/* Photo */}
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="Visitor photo"
          className={`${photoSize} object-cover rounded-xl ring-1 ring-surface-200 flex-shrink-0`}
        />
      ) : (
        <div
          role="img"
          aria-label="No visitor photo on record"
          className={`${photoSize} bg-surface-50 rounded-xl ring-1 ring-surface-200 flex items-center justify-center flex-shrink-0`}
        >
          <svg
            aria-hidden="true"
            className="w-6 h-6 text-surface-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
            />
          </svg>
        </div>
      )}

      {/* Text column */}
      <div className="flex flex-col justify-start gap-2 flex-1">
        {/* Name */}
        <p className="font-bold text-navy-900">{name || '—'}</p>

        {/* Vendor Name */}
        {vendorName && (
          <p className="text-sm text-navy-400">{vendorName}</p>
        )}

        {/* ID Proof — omitted entirely (not blanked) for a viewer whose job is
            deciding on who and why, not checking a document against a face. */}
        {showIdProof && (
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-navy-400 font-medium uppercase tracking-wide">ID Proof</span>
            <span className="font-mono text-navy-600">{maskIdProof(idType, idLast4)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
