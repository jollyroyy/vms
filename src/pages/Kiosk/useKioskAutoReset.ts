import { useCallback, useEffect, useRef, useState } from 'react';

// The kiosk's two timers, extracted out of Kiosk.tsx.
//
// Both exist because the kiosk is unattended: a visitor who wanders off
// mid-form must not leave their half-typed details on screen for the next
// person, and a printed badge must not sit there indefinitely either. They are
// one concern (return the screen to idle by itself) and one file, per the
// one-concern-per-file rule.
export type KioskAutoReset = {
  /** Seconds left on the badge screen, 0 when no countdown is running. */
  resetCountdown: number;
  /** Start (or restart) the 60s inactivity timeout. */
  startIdleTimer: () => void;
  /** Cancel the inactivity timeout — the visitor is doing something. */
  clearIdleTimer: () => void;
  /** Begin the visible countdown that ends in a reset. Defaults to 15s. */
  startBadgeCountdown: (seconds?: number) => void;
  /** Stop both timers without resetting. Used when the caller resets itself. */
  stopAll: () => void;
};

const IDLE_MS = 60000;
const BADGE_SECONDS = 15;

export function useKioskAutoReset(resetAll: () => void): KioskAutoReset {
  const [resetCountdown, setResetCountdown] = useState(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const stopAll = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => { resetAll(); }, IDLE_MS);
  }, [resetAll]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const startBadgeCountdown = useCallback((seconds: number = BADGE_SECONDS) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setResetCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          resetAll();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [resetAll]);

  // Unmounting mid-countdown must not leave a timer calling setState on a dead
  // component, nor a stray reset firing over whatever mounted next.
  useEffect(() => stopAll, [stopAll]);

  return { resetCountdown, startIdleTimer, clearIdleTimer, startBadgeCountdown, stopAll };
}
