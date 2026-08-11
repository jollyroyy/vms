// Converting between a `datetime-local` input's bare wall-clock string and a
// real UTC instant, for an app that is IST-only regardless of where the
// browser sits.
//
// `<input type="datetime-local">` hands back a string with NO timezone, e.g.
// `2026-08-11T22:00`. Passed straight into `pre_approve_visitor_v2`, Postgres
// (session TimeZone = UTC) casts that bare string as UTC: an HOD typing
// 10 PM tonight got `2026-08-11 22:00:00+00`, which an IST reader sees as
// 03:30 the NEXT morning — every booking silently shifted by +5h30m. Two live
// rows showed exactly this.
//
// The fix is never `new Date(local)` — the browser would interpret the
// string in the MACHINE's timezone, which is wrong for any admin whose
// laptop is not set to IST. Instead the components are parsed explicitly and
// the instant is built by hand against the one IST offset this app defines,
// `IST_OFFSET_MS` in `./visitExpiry`. Do not redeclare it here.
import { IST_OFFSET_MS } from './visitExpiry';

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * `2026-08-11T22:00` (typed by a human, meant as IST) -> `2026-08-11T16:30:00.000Z`.
 *
 * Returns `null` for empty, whitespace-only or unparseable input, so a caller
 * can pass it straight through an `if (x)` guard before handing it to an RPC.
 */
export function istLocalToUtcIso(local: string): string | null {
  if (!local || !local.trim()) return null;
  const match = LOCAL_PATTERN.exec(local.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    second ? Number(second) : 0,
  );
  if (Number.isNaN(utcMillis)) return null;

  return new Date(utcMillis - IST_OFFSET_MS).toISOString();
}

/**
 * `2026-08-11T16:30:00.000Z` -> `2026-08-11T22:00`, ready for a datetime-local
 * input value.
 *
 * Exact inverse of `istLocalToUtcIso`: add the offset back, then format as
 * `YYYY-MM-DDTHH:mm` — no seconds, no `Z`, which is what the input accepts.
 * Returns `''` for null/undefined/unparseable, matching how a blank input
 * reads.
 */
export function utcToIstLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const hour = String(shifted.getUTCHours()).padStart(2, '0');
  const minute = String(shifted.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
