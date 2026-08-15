import React from 'react';

/**
 * A crash inside ONE page must never blank the whole application.
 *
 * React unmounts the entire tree when a render or effect throws with no
 * boundary above it, so a single bad page took the app down to a white screen —
 * and because the shell went with it, the only thing a user could do was
 * guess that a hard reload might help. That is what a duplicate realtime
 * channel topic in usePreApprovals did: it threw inside a passive effect on the
 * HOD console and every route, sign-in included, rendered nothing at all.
 *
 * This boundary wraps the routed content only. The shell (nav, sign-out) stays
 * mounted, so the user can always navigate away from the page that failed.
 */
type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Loud, not silent: the panel below tells the user what to do, this tells
    // whoever is reading the console what actually broke.
    console.error('[VMS] Page crashed:', error, info.componentStack);
  }

  private reset = (): void => { this.setState({ error: null }); };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto my-10 max-w-lg rounded-2xl border border-danger-500/25 bg-danger-50 p-6 text-center">
        <h2 className="font-display text-lg font-bold text-danger-700">This page could not be displayed</h2>
        <p className="mt-2 text-sm text-danger-700/80">
          Something went wrong while loading it. The rest of the application is still available from the
          navigation.
        </p>
        {/* The message is shown, never hidden: a guard reading it out to whoever
            supports them is faster than asking them to open a console. */}
        <p className="mt-3 break-words rounded-lg bg-white/60 px-3 py-2 font-mono text-[11px] text-danger-700">
          {error.message}
        </p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-5 rounded-xl bg-danger-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-danger-700">
          Try again
        </button>
      </div>
    );
  }
}
