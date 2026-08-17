import React from 'react';
import AdminKpiTile from '../../components/AdminKpiTile';
import type { PreRegKpis } from '../../lib/preRegistration';
import { ICON_CALENDAR, ICON_CHECK_CIRCLE, ICON_X_CIRCLE } from '../../lib/tileIcons';

type Props = { kpis: PreRegKpis; loading: boolean };

// Three cards, each a fact about the PRE-REGISTRATION population as a whole —
// never a drill-down. `AdminKpiTile`'s own contract already says why: the
// admin surface cannot act on a row, and the table right below these cards is
// already the full list they are counting, so a card here is a summary, not a
// filter control in disguise.

export default function AdminPreRegistrationKpis({ kpis, loading }: Props): React.ReactElement {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <AdminKpiTile
        label="Invites Sent"
        value={String(kpis.invitesSent)}
        icon={ICON_CALENDAR}
        tone="brand"
        loading={loading}
        caption="Visitor was told about their pass"
      />
      <AdminKpiTile
        label="Confirmed"
        value={String(kpis.confirmed)}
        icon={ICON_CHECK_CIRCLE}
        tone="success"
        loading={loading}
        caption="Pre-approved visitors who arrived"
      />
      <AdminKpiTile
        label="No-shows"
        value={String(kpis.noShows)}
        icon={ICON_X_CIRCLE}
        tone="danger"
        loading={loading}
        caption="Booked, never arrived"
      />
    </div>
  );
}
