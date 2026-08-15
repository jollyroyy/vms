import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import ModalCloseButton from './ModalCloseButton';
import { useEscapeKey } from '../lib/useEscapeKey';

const TIMEOUT_MS = 10 * 60 * 1000;
const COUNTDOWN_SEC = 60;

export default function SessionTimeout(): React.ReactElement | null {
  const [showPrompt, setShowPrompt] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const promptVisibleRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const signOut = useCallback(async () => {
    clearTimers();
    promptVisibleRef.current = false;
    setShowPrompt(false);
    await supabase.auth.signOut();
  }, [clearTimers]);

  const startTimer = useCallback(() => {
    clearTimers();
    promptVisibleRef.current = false;
    setShowPrompt(false);
    setCountdown(COUNTDOWN_SEC);
    timerRef.current = setTimeout(() => {
      promptVisibleRef.current = true;
      setShowPrompt(true);
      setCountdown(COUNTDOWN_SEC);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            signOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, TIMEOUT_MS);
  }, [clearTimers, signOut]);

  useEffect(() => {
    startTimer();

    const resetOnActivity = () => {
      if (!promptVisibleRef.current) startTimer();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((evt) => document.addEventListener(evt, resetOnActivity, { passive: true }));
    return () => {
      clearTimers();
      events.forEach((evt) => document.removeEventListener(evt, resetOnActivity));
    };
  }, [startTimer, clearTimers]);

  // Close (× or Escape) means "Keep session" — the SAME action as the button.
  //
  // It briefly did something else: hide the prompt and let the countdown run
  // on. That turns the one and only warning a user gets into a trap — dismiss
  // it and the sign-out still lands mid-task, wiping unsaved work with nothing
  // on screen to explain why. Clicking × is itself proof that a human is
  // present, which is precisely what the idle timer exists to establish.
  //
  // This does not weaken the timeout: an unattended terminal has nobody to
  // click anything, so it still signs out on schedule, and closing buys exactly
  // one more idle window rather than disabling the clock. GatePass's
  // SessionTimeout makes the same call — the two apps must not disagree about
  // what × does on the same dialog.
  const dismiss = useCallback(() => startTimer(), [startTimer]);
  useEscapeKey(dismiss, showPrompt);

  if (!showPrompt) return null;

  return (
    <div className="modal-overlay z-[9999]">
      <div className="modal-content p-6 relative">
        <ModalCloseButton onClose={dismiss} />
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-warning-50 border border-warning-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-navy-950 font-display px-8">Session Timeout</h3>
            <p className="text-sm text-navy-700 mt-1">
              Your session has been idle for 10 minutes. Do you want to stay signed in?
            </p>
          </div>
          <div className="w-full bg-surface-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-warning-500 to-warning-600 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / COUNTDOWN_SEC) * 100}%` }}
            />
          </div>
          <p className="text-xs text-navy-500 dark:text-navy-400">
            Auto-logout in <span className="font-semibold text-warning-600 tabular-nums">{countdown}s</span>
          </p>
          <div className="flex gap-3 w-full pt-1">
            <button onClick={signOut} className="btn-secondary flex-1 text-sm">
              Sign out
            </button>
            <button onClick={() => startTimer()} className="btn-accent flex-1 text-sm">
              Keep session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
