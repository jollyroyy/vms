import React, { useMemo, useState } from 'react';
import AdminPageHeader from './AdminPageHeader';
import AdminRangeBar from './AdminRangeBar';
import AdminKpiTile from '../../components/AdminKpiTile';
import BadgePrintsTable from './BadgePrintsTable';
import { useBadgePrints } from '../../lib/useBadgePrints';
import { badgeKpis } from '../../lib/adminBadges';
import { ICON_PEOPLE, ICON_CHECK_CIRCLE } from '../../lib/tileIcons';
import { istDateKey } from '../../lib/visitExpiry';
import { computeDateRange, type RangePreset } from '../../lib/reportsDateRange';

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
// RANGED, NOT TODAY-ONLY (client instruction, 2026-08-17, the same instruction
// that ranged the Visitors Log). A print queue is naturally "today", but an
// admin auditing badge stock or chasing a reprint pattern needs more than one
// day's worth, and a today-only tab gave them no route to last week's prints
// at all — the same gap the Visitors Log had before this instruction. The
// range bar and the "Historical" chip are the same control and the same
// wording every other ranged admin tab carries, so an admin learns the picker
// once.
//
// The three tiles and the table below them are fed by the SAME ranged fetch
// (`useBadgePrints(range)`), so a tile's count and the table's row count can
// never disagree — `guardTiles.ts`'s rule, applied to a fourth board.

const ICON_REPRINT =
  'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99';

const PRINT_LIMIT = 500;

export default function AdminBadges(): React.ReactElement {
  const today = useMemo(() => istDateKey(new Date()), []);
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [endDate, setEndDate] = useState<string>(today);
  const range = useMemo(() => computeDateRange(preset, endDate), [preset, endDate]);

  const { prints, loading } = useBadgePrints(range, PRINT_LIMIT);
  const kpis = badgeKpis(prints);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <AdminPageHeader title="Badge Printing" blurb="Badges the gate has issued." scope="historical" />

      <AdminRangeBar
        preset={preset}
        endDate={endDate}
        today={today}
        onPresetChange={setPreset}
        onEndDateChange={setEndDate}
        noun="badge prints"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <AdminKpiTile
          label="Printed"
          value={String(kpis.printed)}
          icon={ICON_PEOPLE}
          tone="brand"
          loading={loading}
          caption={kpis.printed === 0 ? 'No badge was printed in this window' : 'Badges issued at the gate'}
        />
        <AdminKpiTile
          label="Reprints"
          value={String(kpis.reprints)}
          icon={ICON_REPRINT}
          tone="warning"
          loading={loading}
          captionToned={kpis.reprints > 0}
          caption="A badge issued more than once"
        />
        <AdminKpiTile
          label="Visitors Badged"
          value={String(kpis.visitorsBadged)}
          icon={ICON_CHECK_CIRCLE}
          tone="success"
          loading={loading}
          caption={kpis.visitorsBadged === 0 ? 'No badge was printed in this window' : 'Distinct visitors, in this window'}
        />
      </div>

      <BadgePrintsTable prints={prints} loading={loading} />

      {!loading && prints.length >= PRINT_LIMIT && (
        <p className="text-xs text-navy-500 mt-3">
          The selected window hit the {PRINT_LIMIT}-row cap — narrow the date range above to
          see every print in it.
        </p>
      )}
    </div>
  );
}
