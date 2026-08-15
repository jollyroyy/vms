// Every date and time the app prints, in ONE place, in IST.
//
// `timeZone: 'Asia/Kolkata'` is not optional and not a preference. This
// deployment is IST wherever the machine is: a guard PC on a fresh Windows
// image, a laptop carried in from another region, a browser with a stale
// profile. Without the pin, `toLocaleString` resolves against the OS clock, so
// on such a machine every arrival time, pass expiry and check-in stamp on
// screen is silently and *consistently* wrong — no error, no warning, just
// plausible numbers. The topbar clock was pinned first (2026-08-15) and that
// made the divergence visible: one correct clock sitting above a screenful of
// times computed a different way.
//
// This is also why local `toLocaleTimeString` reimplementations are banned.
// Roughly ten of them had accumulated across the guard surface, each one a
// place the timezone could be forgotten again. If a screen needs a shape these
// helpers do not cover, add the shape HERE — do not hand-roll it at the call
// site. `IST_OFFSET_MS` in `lib/visitExpiry.ts` remains the one place the raw
// offset is defined for arithmetic; this is the display half of the same rule.
import { istDateKey } from './visitExpiry';

export const IST = 'Asia/Kolkata';

/** "14 Aug 2026, 10:30 am" — the default for anything a guard acts on. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/** "10:30 am". Only safe where the DAY is already established by the
 *  surrounding UI — otherwise use `formatStamp`, which decides for you. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', {
    timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/** "14 Aug 2026" — date with no time. Two components hand-rolled this because
 *  it did not exist here, which is exactly how the timezone gets dropped. */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: IST, day: 'numeric', month: 'short', year: 'numeric',
  });
}

/**
 * A timestamp on a list that is NOT date-bounded: bare time if the instant
 * falls on today's IST day, date + time otherwise.
 *
 * The guard surface deliberately carries visitors from earlier days — someone
 * still inside from last night is the whole reason those queries are unbounded
 * — so a bare "03:30" on those lists says WHEN but not WHETHER that when is
 * today. This keeps the compact reading for the common case and pays the extra
 * width only on the rows where it actually carries information.
 */
export function formatStamp(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  if (istDateKey(d) === istDateKey(now)) return formatTime(iso);
  return formatDateTime(iso);
}

export function formatDuration(checkedInAt: string | null | undefined): { text: string; isOvertime: boolean } {
  if (!checkedInAt) return { text: '—', isOvertime: false };
  const ms = Date.now() - new Date(checkedInAt).getTime();
  if (ms < 0) return { text: '0m', isOvertime: false };
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return { text: `${hours}h ${minutes}m`, isOvertime: hours >= 9 };
  return { text: `${minutes}m`, isOvertime: false };
}

/** Elapsed time between two instants. With `to` omitted the clock runs until now
 *  (live, for visitors still inside). Shared by the Who's Inside card.
 *
 *  Timezone-free by construction: this is a DIFFERENCE between two instants,
 *  and a duration is the same number in every zone. */
export function formatElapsed(fromIso: string | null | undefined, toIso?: string | null | undefined): { text: string; isOvertime: boolean } {
  if (!fromIso) return { text: '—', isOvertime: false };
  const end = toIso ? new Date(toIso).getTime() : Date.now();
  const ms = end - new Date(fromIso).getTime();
  if (ms < 0) return { text: '0m', isOvertime: false };
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return { text: `${hours}h ${minutes}m`, isOvertime: hours >= 9 };
  return { text: `${minutes}m`, isOvertime: false };
}
