import { useEffect, useState } from 'react';
import { formatElapsed } from './formatDate';

/** Elapsed time that keeps counting for as long as the visit is still open.
 *
 *  `formatElapsed` is a pure snapshot taken at render time. Without a timer the
 *  figure a guard reads is frozen at whatever the last render happened to be —
 *  on the details popup, which renders once when it opens, the duration never
 *  moved at all.
 *
 *  Ticks every 10s. The display has minute resolution, so anything finer only
 *  burns renders, and anything coarser lets the visible minute lag behind the
 *  wall clock by an amount the guard can notice.
 */
export function useLiveElapsed(
  fromIso: string | null | undefined,
  toIso?: string | null,
): { text: string; isOvertime: boolean; live: boolean } {
  const live = Boolean(fromIso) && !toIso;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [live]);

  return { ...formatElapsed(fromIso, toIso ?? undefined), live };
}
