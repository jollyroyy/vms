import { useEffect, useState } from 'react';

/**
 * "Add to Home Screen", offered by the app instead of hidden in a browser menu.
 *
 * WHY THIS IS NOT A BUTTON THAT ALWAYS RENDERS. A page cannot open the install
 * dialog whenever it likes: Chrome fires `beforeinstallprompt` only once it has
 * decided the app IS installable — served over HTTPS, manifest parsed, icons
 * fetched, a service worker with a fetch handler in control — and `prompt()` is
 * valid only on the event it handed over. So this hook reports what the browser
 * has already decided, and a button that renders on `canInstall` is the only
 * kind that cannot lie. Everywhere the event never comes — iOS Safari, which has
 * no such API at all, Firefox, an already-installed app, a desktop the user will
 * never install on — nothing renders and nobody is told about a button that
 * would do nothing. That is the same rule as OverstayAlertBanner and
 * OfflineBanner: a screen says nothing rather than something it cannot stand
 * behind.
 *
 * THE LISTENER IS REGISTERED AT MODULE SCOPE, NOT IN THE EFFECT, and that is
 * load-bearing. The event fires once, early, and it is NOT re-dispatched to a
 * listener that arrives later — so a listener added when a component mounts can
 * miss it outright and the button then never appears on a phone that could have
 * installed the app. Importing this module registers the capture; the hook only
 * subscribes to what was captured.
 */

/** Chrome's event. Not in lib.dom — it is not on a standards track. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<(value: boolean) => void>();

function publish(): void {
  for (const notify of subscribers) notify(deferred !== null);
}

/** True when the app is ALREADY running from the home screen. Chrome does not
 *  fire the event in that case, but Safari's `navigator.standalone` is the only
 *  signal on iOS, and the media query is the cross-browser one. */
function installedAlready(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Without preventDefault Chrome may show its own mini-infobar as well, and
    // the same install would be offered twice on one screen.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    publish();
  });
  // The app can be installed from the browser's own menu while this page is
  // open, and the stored event is spent the moment it is.
  window.addEventListener('appinstalled', () => {
    deferred = null;
    publish();
  });
}

export interface InstallPrompt {
  /** The browser has offered an install for THIS visit and it is unspent. */
  canInstall: boolean;
  /** Opens the browser's install dialog. Resolves once the user has answered. */
  install: () => Promise<void>;
}

export function useInstallPrompt(): InstallPrompt {
  const [canInstall, setCanInstall] = useState(() => deferred !== null && !installedAlready());

  useEffect(() => {
    const notify = (value: boolean) => setCanInstall(value && !installedAlready());
    subscribers.add(notify);
    // The event can land between the initial state and this subscription.
    notify(deferred !== null);
    return () => { subscribers.delete(notify); };
  }, []);

  return {
    canInstall,
    install: async () => {
      const event = deferred;
      if (!event) return;
      // Spent before it is awaited, not after: prompt() throws on a second call,
      // and two taps on a slow phone are one tap too many.
      deferred = null;
      publish();
      await event.prompt();
      await event.userChoice;
    },
  };
}
