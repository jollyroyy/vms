import { useEffect } from 'react';

/** Calls `onEscape` whenever the Escape key is pressed while `active` (default
 * true). Shared by every popup/modal/overlay so Escape-to-close behaves
 * identically everywhere instead of being hand-rolled per component —
 * VisitorDetails.tsx originated this exact pattern before it was extracted. */
export function useEscapeKey(onEscape: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEscape, active]);
}
