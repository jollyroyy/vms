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
    <div className={photoUrl ? 'flex gap-4' : 'flex'}>
      {/* THE PHOTO SLOT EXISTS ONLY WHEN THERE IS A PHOTO (client instruction,
          2026-08-18). A pre-approval is raised hours or days before anybody
          points a camera at the visitor — the approver types a name and a slot,
          and `WalkInRequest`'s capture belongs to a different route entirely —
          so the grey silhouette that used to stand here was a placeholder for
          something nobody had failed to provide. On the success pass it read as
          a broken image, and it pushed every fact beside it into a column two
          thirds of the card wide for no reason.
          Nothing is lost at the gate: check-in uploads `photo_data`, so the
          same block draws the real face the moment there is one, and the
          missing-photo case a guard DOES need told about is the ID scan, which
          `CheckInPhotoStep` refuses to proceed without. */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt="Visitor photo"
          className={`${photoSize} object-cover rounded-xl ring-1 ring-surface-200 flex-shrink-0`}
        />
      )}

      {/* Text column */}
      <div className="flex flex-col justify-start gap-2 flex-1">
        {/* Name */}
        <p className="font-bold text-navy-900">{name || '—'}</p>

        {/* Company — labelled like every other fact on the pass. A bare value
            with no caption ("Acme Corp" floating under a name with nothing
            saying what it is) reads as a stray word, not a fact.

            NO `dark:text-navy-*` HERE. The navy scale is INVERTED in dark mode,
            so this value's old `text-navy-700 dark:text-navy-200` rendered it
            near-black on a dark card: the word "Company" showed and the company
            NAME did not, which is exactly how it was reported (2026-08-15).
            `break-words` because a real vendor name is long and must not be
            clipped on the pass a guard reads back. */}
        {vendorName && (
          <div>
            <p className="text-micro text-navy-700 uppercase leading-none mb-0.5">Company</p>
            <p className="text-sm font-semibold text-navy-800 break-words">{vendorName}</p>
          </div>
        )}

        {/* ID Proof — omitted entirely (not blanked) for a viewer whose job is
            deciding on who and why, not checking a document against a face. */}
        {showIdProof && (
          <div className="flex items-baseline gap-2 text-xs">
            <span className="text-navy-700 font-medium uppercase tracking-wide">ID Proof</span>
            <span className="font-mono text-navy-600">{maskIdProof(idType, idLast4)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
