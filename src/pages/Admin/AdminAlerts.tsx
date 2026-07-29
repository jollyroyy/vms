// Success / error banners for the Admin Panel, plus the small hook that owns the
// auto-dismiss timer so each manager component doesn't re-implement it.
import React, { useCallback, useEffect, useRef, useState } from 'react';

const DISMISS_MS = 4000;

export type AdminMessages = {
  success: string;
  error: string;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  clear: () => void;
};

export function useAdminMessages(): AdminMessages {
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setSuccess(''); setError(''); }, DISMISS_MS);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return {
    success,
    error,
    showSuccess: useCallback((msg: string) => { setError(''); setSuccess(msg); arm(); }, [arm]),
    showError: useCallback((msg: string) => { setSuccess(''); setError(msg); arm(); }, [arm]),
    clear: useCallback(() => { setSuccess(''); setError(''); }, []),
  };
}

export default function AdminAlerts({ success, error }: { success: string; error: string }): React.ReactElement | null {
  if (!success && !error) return null;
  return (
    <div className="space-y-2.5">
      {success && (
        <div className="alert-success" role="status">
          <svg className="w-4 h-4 text-success-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {success}
        </div>
      )}
      {error && (
        <div className="alert-error" role="alert">
          <svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
