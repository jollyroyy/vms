// The HOD dashboard's KPI board: five tiles, and the rows behind whichever one
// is pressed (client instruction, 2026-08-16 — every KPI must be drillable).
//
// It follows the guard board's one rule: the number IS the length of the list
// the tile opens, both taken from lib/hodTiles.ts. Pressing a tile swaps the
// panel below; pressing the pressed tile collapses it, because reading the board
// must never cost you the board.
//
// The rows are DISPLAY-ONLY. Approving or declining happens on the two decision
// desks, where the request's reason box and the audit trail live — a dashboard
// that could clear a visitor would be a second route to the same write with
// nothing saying which was authoritative.
import React from 'react';
import type { Visit } from '../../types/index';
import { HOD_TILE_KEYS, HOD_TILE_META, type HodTileKey } from '../../lib/hodTiles';
import { hostName, purposeLabel, visitDay, visitTime, visitorCompany, visitorName } from '../../lib/hodVisitLabels';

type Props = {
  tiles: Record<HodTileKey, Visit[]>;
  selected: HodTileKey | null;
  onSelect: (key: HodTileKey | null) => void;
  loading: boolean;
};

export default function HodKpiBoard({ tiles, selected, onSelect, loading }: Props): React.ReactElement {
  const rows = selected ? tiles[selected] : [];
  const meta = selected ? HOD_TILE_META[selected] : null;

  return (
    <>
      <section className="hod-metrics" aria-busy={loading}>
        {HOD_TILE_KEYS.map((key) => {
          const info = HOD_TILE_META[key];
          const active = selected === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              aria-controls="hod-kpi-drill"
              onClick={() => onSelect(active ? null : key)}
              className={`hod-stat hod-stat--button${info.tone ? ` hod-stat--${info.tone}` : ''}${active ? ' is-selected' : ''}`}
            >
              <span className="hod-stat__icon">{info.icon}</span>
              <span>
                <small>{info.label}</small>
                <strong>{loading ? '—' : tiles[key].length}</strong>
                <em>{info.caption}</em>
              </span>
            </button>
          );
        })}
      </section>

      {/* The panel only exists once a tile is pressed. An empty frame carrying
          "pick a tile" would spend a row of the screen on an instruction. */}
      {selected && meta && (
        <article className="hod-card hod-card--drill" id="hod-kpi-drill">
          <div className="hod-card__head">
            <span>{meta.icon} &nbsp; {meta.label.toUpperCase()}</span>
            <button type="button" onClick={() => onSelect(null)}>Close&nbsp; ×</button>
          </div>
          {rows.length === 0 ? (
            <div className="hod-empty">{loading ? 'Loading…' : meta.empty}</div>
          ) : (
            rows.map((visit) => (
              <div className="hod-pulse-row" key={visit.id}>
                <time>{visitTime(visit)}<b>{visitDay(visit)}</b></time>
                <p>
                  <strong>{visitorName(visit)}</strong>
                  <small>{visitorCompany(visit)} · {purposeLabel(visit)} · {hostName(visit)}</small>
                </p>
              </div>
            ))
          )}
        </article>
      )}
    </>
  );
}
