import React, { useState } from 'react';
import { formatDateTime } from '../lib/formatDate';
import { canRoleShowPass, canShowPass } from '../lib/passVisibility';
import type { ReportVisit } from '../lib/reportRow';
import type { UserRole } from '../types/index';
import { visitOrigin, visitOriginLabel } from '../lib/visitOrigin';
import PreApprovalPass from './PreApprovalPass';

// The Overview tab of the visitor popup — who is visiting, who they are here to
// see, when, and anything they are carrying. Split out of VisitorDetails.tsx
// when the ID tab landed (2026-08-15): the shell owns the chrome, the header
// card and which tab is showing; each tab owns its own content.
//
// The ID row that used to sit at the bottom of this section is GONE from here.
// It lives in VisitorDetailsIdCard now, and rendering it in both places would
// put the same value on screen twice — the rule this codebase keeps.

function InfoRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-navy-300 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-micro text-navy-500 uppercase leading-none mb-0.5">{label}</p>
        <p className="text-body font-medium text-navy-800 truncate">{value}</p>
        {/* The department the host belongs to — folded under their name rather
            than kept as its own row, so it is never rendered twice on the
            same card. */}
        {sub && <p className="text-caption text-navy-500 truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const ICON = {
  phone: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />,
  person: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />,
  tag: <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />,
  clock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />,
  // A door with an arrow going in — which way this visitor came through.
  route: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />,
  exit: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15m-3 0l-3-3m0 0l3-3m-3 3H15" />,
  box: <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />,
};

const Ico = ({ d }: { d: React.ReactNode }) => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{d}</svg>
);

export default function VisitorDetailsOverview({
  visit: v, viewerRole,
}: {
  visit: ReportVisit;
  viewerRole?: UserRole | null;
}): React.ReactElement {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="px-5 pt-4 pb-3 animate-fade-in">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <InfoRow label="Phone" value={v.visitor?.phone ?? '—'} icon={<Ico d={ICON.phone} />} />
        <InfoRow
          label="Person to Meet"
          value={v.host?.full_name ?? '—'}
          sub={v.department?.name}
          icon={<Ico d={ICON.person} />}
        />
        <InfoRow label="Purpose" value={v.purpose ?? '—'} icon={<Ico d={ICON.tag} />} />
        {/* WHICH DESK this visitor came through (client instruction,
            2026-08-16: "always everybody should be able to see who is walk-in
            and who is pre-approved"). Every LIST already carried the answer —
            the guard board's Type of Visitor column, the grid card's outline
            chip, the Entry & Exit table, the check-in summary — but the popup
            those lists open did not, so clicking a visitor to read their record
            lost the one fact the row beside them had just stated.

            UNCONDITIONAL here, unlike VisitorGridCard, which hides its chip
            whenever `statusProvesOrigin` says the status badge has already
            spoken. That gate exists because `STATUS_STYLES.approved` reads
            "Pre-approved" in so many words. This popup's badge does not: it
            prints the raw status ("approved", "checked in"), so there is no
            duplicate to avoid, and a record opened from nine different surfaces
            has no lane label above it to fall back on either.

            Same lib/visitOrigin.ts the lists use, so the popup and the row that
            opened it cannot disagree about a visitor — read the INFERRED caveat
            there before trusting it on a pre-2026-08 row. */}
        <InfoRow
          label="Type of Visitor"
          value={visitOriginLabel(visitOrigin(v))}
          icon={<Ico d={ICON.route} />}
        />
        {/* The time the HOD booked the visitor for. It is the one field the
            approver chose themselves, and it is what tells anyone reading this
            whether the visitor is early, expected or overdue — none of which is
            answerable from the status alone. Absent for walk-ins, which have no
            scheduled_for by construction, so the row is conditional rather than
            showing a dash on every walk-in. */}
        {v.scheduled_for && (
          <InfoRow label="Expected At" value={formatDateTime(v.scheduled_for)} icon={<Ico d={ICON.clock} />} />
        )}
        {/* Only when the approver actually named a departure. Its absence is the
            ordinary case and means "no answer given", not "leaves immediately". */}
        {v.expected_departure && (
          <InfoRow label="Expected Departure" value={formatDateTime(v.expected_departure)} icon={<Ico d={ICON.exit} />} />
        )}
      </div>

      {v.carrying_remarks ? (
        <div className="mt-3.5 flex items-start gap-2 text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{ICON.box}</svg>
          <div className="min-w-0">
            <p className="text-caption font-semibold">Carrying</p>
            <p className="text-caption mt-0.5 break-words">{v.carrying_remarks}</p>
          </div>
        </div>
      ) : v.carrying_material ? (
        <div className="mt-3.5 flex items-center gap-2 text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{ICON.box}</svg>
          <span className="text-caption font-semibold">Carrying Material</span>
        </div>
      ) : null}

      {/* Two independent gates, both must pass. canShowPass says the visit is at
          a stage where a pass still means something; canRoleShowPass says this
          viewer may be shown one at all — guards never may, so the toggle, the
          QR and both downloads disappear together for them. */}
      {canShowPass(v.status) && canRoleShowPass(viewerRole) && (
        <div className="mt-3.5">
          <button
            type="button"
            onClick={() => setShowPass((prev) => !prev)}
            className="w-full text-caption font-bold text-brand-600 dark:text-brand-300 hover:text-brand-700 dark:hover:text-brand-200 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-brand-200 dark:border-brand-500/30 bg-brand-50/60 hover:bg-brand-50 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v4.5h-4.5v-4.5zM15.75 4.5h4.5v4.5h-4.5v-4.5zM3.75 15.75h4.5v4.5h-4.5v-4.5zM15.75 15.75h1.5v1.5h-1.5v-1.5zM19.5 15.75h.75v.75h-.75v-.75zM15.75 19.5h.75v.75h-.75v-.75zM18.75 18.75h1.5v1.5h-1.5v-1.5z" /></svg>
            {showPass ? 'Hide Pass' : 'View Pass'}
          </button>
          {/* The header card above already shows the photo, name and company;
              the ID tab shows the document. The expanded pass must NOT repeat
              any of them — identityShownElsewhere strips the identity block
              (and the ID with it) out of PreApprovalPass. */}
          {showPass && <PreApprovalPass visit={v} identityShownElsewhere />}
        </div>
      )}
    </div>
  );
}
