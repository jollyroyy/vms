import React, { useEffect, useState } from 'react';

// "You are offline" — said out loud, because the installed app cannot say it
// any other way.
//
// THIS IS THE OTHER HALF OF THE SERVICE WORKER. public/sw.js falls navigations
// back to the cached shell so the app still OPENS with no connection. What it
// deliberately does not do is cache a single Supabase response, so what opens
// is the real app with every list empty and every count zero — which on this
// project's own rules is the worst thing a screen can do: an HOD reading
// "no walk-ins waiting" cannot tell it from a quiet morning, and somebody is
// standing at reception. The banner is what makes the empty screen honest.
//
// It renders NOTHING when online — the same rule OverstayAlertBanner follows.
// A permanent "connected" chip would be a fabricated fact the moment the signal
// dropped between the render and the reader.

/** `navigator.onLine === false` is trustworthy; `true` only means an interface
 *  is up, which is why nothing here claims the connection is good. */
function offlineNow(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export default function OfflineBanner(): React.ReactElement | null {
  const [offline, setOffline] = useState<boolean>(offlineNow);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    // The events can fire between the initial state and this effect running.
    setOffline(offlineNow());
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="no-print mb-5 rounded-2xl border border-warning-500/30 bg-warning-50 dark:bg-warning-500/10 px-4 py-3 flex items-start gap-3">
      <svg className="w-5 h-5 shrink-0 text-warning-700 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 5.106a10.5 10.5 0 0110.02 3.02M3.98 8.126a10.5 10.5 0 013.03-2.02m-.53 5.03a6.5 6.5 0 016.02-1.02m-3.02 6.02a2.5 2.5 0 013.04 0M12 19.5h.008v.008H12V19.5z" />
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-bold text-warning-700">You are offline</p>
        <p className="text-sm text-warning-700/90 mt-0.5">
          Nothing on this screen is being updated. Counts, lists and approvals are as they
          were when the connection dropped — do not act on them until this clears.
        </p>
      </div>
    </div>
  );
}
