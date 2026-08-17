import React from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminKpiTile from '../../components/AdminKpiTile';
import BadgePrintsTable from './BadgePrintsTable';
import { useBadgePrints } from '../../lib/useBadgePrints';
import { badgeKpis } from '../../lib/adminBadges';
import { ICON_PEOPLE, ICON_CHECK_CIRCLE } from '../../lib/tileIcons';

// The admin's Badge Printing tab.
//
// THIS TAB READS MIGRATION 087'S LOG AND NEVER WRITES IT. There is no print
// button and no print queue here, by the same standing rule that keeps QR/pass
// minting out of the guard's Visitors surface: a badge is issued at the gate,
// by the guard who can see the visitor standing in front of them, and a print
// control on an admin's desk screen would let someone mint an entry credential
// for a person they cannot see. `badge_prints` has no update or delete policy
// either (append-only) — a print either happened or it did not, and this
// screen only ever reports which.
//
// The three tiles and the table below them are fed by the SAME today-window
// fetch (`useBadgePrints(true)`), so a tile's count and the table's row count
// can never disagree — `guardTiles.ts`'s rule, applied to a fourth board.

const ICON_REPRINT =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99';

export default function AdminBadges(): React.ReactElement {
  const { prints, loading } = useBadgePrints(true);
  const kpis = badgeKpis(prints);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader title="Badge Printing" blurb="Badges the gate has issued." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <AdminKpiTile
          label="Printed Today"
          value={String(kpis.printedToday)}
          icon={ICON_PEOPLE}
          tone="brand"
          loading={loading}
          caption={kpis.printedToday === 0 ? 'No badge has been printed today' : 'Badges issued at the gate'}
        />
        <AdminKpiTile
          label="Reprints Today"
          value={String(kpis.reprintsToday)}
          icon={ICON_REPRINT}
          tone="warning"
          loading={loading}
          captionToned={kpis.reprintsToday > 0}
          caption="A badge issued more than once"
        />
        <AdminKpiTile
          label="Visitors Badged"
          value={String(kpis.visitorsBadgedToday)}
          icon={ICON_CHECK_CIRCLE}
          tone="success"
          loading={loading}
          caption={kpis.visitorsBadgedToday === 0 ? 'No badge has been printed today' : 'Distinct visitors, today'}
        />
      </div>

      <BadgePrintsTable prints={prints} loading={loading} />
    </div>
  );
}
