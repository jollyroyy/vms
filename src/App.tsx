import React, { useEffect, useState } from 'react';
import HODConsole from './pages/HOD/HODConsole';
import HODApprovals from './pages/HOD/Approvals';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from './types/index';
import { ROLE_ROUTES } from './lib/roleRoutes';
import { ThemeProvider } from './lib/theme';

// Pages
import LoginPage          from './pages/Login';
import ResetPassword      from './pages/ResetPassword';
import ForcePasswordChange from './pages/ForcePasswordChange';
import { hasRecoveryHash, isRecoveryPending, markRecoveryPending, clearRecoveryPending } from './lib/passwordRecovery';
import VisitorsDashboard  from './pages/Shared/VisitorsDashboard';
import GuardDashboard     from './pages/Guard/Dashboard';
import GuardLiveQueue      from './pages/Guard/GuardLiveQueue';
import GuardPreApprovals  from './pages/Guard/PreApprovals';
import GuardScanPass      from './pages/Guard/ScanPass';
import RegisterWalkIn     from './pages/Guard/RegisterWalkIn';
import GuardSearch        from './pages/Guard/Search';
import WhosInside         from './pages/Shared/WhosInside';
import ReportsPage        from './pages/Shared/Reports';
import ProfilePage        from './pages/Shared/Profile';
import { adminRoutes } from './routes/adminRoutes';
import CeoBlacklistRemovals from './pages/CEO/CeoBlacklistRemovals';
import NotFoundPage       from './pages/NotFound';
import KioskPage          from './pages/Kiosk/Kiosk';
import AppShell           from './components/layout/AppShell';
import SessionTimeout     from './components/SessionTimeout';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { BootSplash, NoRoleScreen, SuspendedScreen } from './components/BootScreens';
import { isUserRole, resolveUserRole } from './lib/resolveUserRole';
import { fetchAccountActive, fetchMustChangePassword } from './lib/startupGates';

/**
 * SEC-7: Signs the user out immediately if their role is not allowed on the current route.
 * Uses ROLE_ROUTES as the single source of truth — never trusts the URL or a per-route prop.
 * Renders nothing until signOut completes to prevent flash of forbidden content.
 */
function ProtectedRoute({ children, role }: { children: React.ReactElement; role: UserRole | null }) {
  const location = useLocation();
  const allowed = role !== null ? (ROLE_ROUTES[role] ?? []) : [];
  const forbidden = role !== null && !allowed.some((r) => location.pathname.startsWith(r));
  if (role === null) return null;
  if (forbidden) {
    const fallback = allowed[0] ?? '/';
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export default function App(): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole]       = useState<UserRole | null>(null);
  // Seeded synchronously: supabase-js consumes the recovery hash during client init,
  // which can happen before onAuthStateChange is wired up below. The durable flag keeps
  // the gate up across reloads, so abandoning the form cannot leave a usable session.
  const [recovering, setRecovering] = useState<boolean>(() => {
    if (hasRecoveryHash()) { markRecoveryPending(); return true; }
    return isRecoveryPending();
  });
  // The two startup gates: an admin-set temporary password (migration 064) and
  // a withdrawn account (migration 094). `null` means "unknown / still
  // checking" and renders the same loading screen as `loading`, so the app
  // shell can never flash before we know either answer. Each gate's fail-open
  // value is decided in lib/startupGates.ts, not here.
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  const [accountActive, setAccountActive] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = 'Secure Gate — Visitor Management';
  }, []);

  // The two startup gates live in lib/startupGates.ts — one shape, asked twice,
  // both failing OPEN and neither failing silently. See that file for why
  // neither may read `profiles` or `user_status` directly.
  const checkMustChangePassword = async () => {
    setMustChangePassword(null);
    setMustChangePassword(await fetchMustChangePassword());
  };

  const checkAccountActive = async () => {
    setAccountActive(null);
    setAccountActive(await fetchAccountActive());
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Flag set but no session means the recovery session already ended (expired or
      // signed out) — drop the gate so the user isn't trapped on the reset screen.
      if (!data.session && isRecoveryPending()) {
        clearRecoveryPending();
        setRecovering(false);
      }
      setSession(data.session);
      if (data.session) {
        const metadataRole = data.session.user.app_metadata?.role;
        if (isUserRole(metadataRole)) {
          setRole(metadataRole);
        } else {
          setRole(null);
          void resolveUserRole(data.session.user.id, metadataRole).then(setRole);
        }
        void checkMustChangePassword();
        void checkAccountActive();
      } else {
        setRole(null);
        setMustChangePassword(false);
        setAccountActive(true);
      }
      setLoading(false);
    }).catch((err: unknown) => {
      // A transient storage or Supabase client failure must never leave the
      // application on an indefinite blank/loading screen. Fall back to the
      // unauthenticated route, where the user can always see the sign-in form.
      console.error('[VMS] Unable to restore the authentication session:', err);
      setSession(null);
      setRole(null);
      setMustChangePassword(false);
      setAccountActive(true);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // A recovery link signs the user into a normal, persisted session. Without this
      // gate they land on their dashboard and never get to choose a new password.
      if (event === 'PASSWORD_RECOVERY') { markRecoveryPending(); setRecovering(true); }
      // Deliberately NOT cleared on SIGNED_OUT: ResetPassword signs the recovery
      // session out on success, and clearing here would unmount the page before the
      // user sees the confirmation. Its "Back to sign in" link is a full navigation,
      // which reloads without the recovery hash and re-seeds this to false.
      setSession(s);
      if (s) {
        const metadataRole = s.user.app_metadata?.role;
        if (isUserRole(metadataRole)) {
          setRole(metadataRole);
        } else {
          setRole(null);
          void resolveUserRole(s.user.id, metadataRole).then(setRole);
        }
        if (event === 'SIGNED_IN') { void checkMustChangePassword(); void checkAccountActive(); }
      } else {
        setRole(null);
        setMustChangePassword(false);
        setAccountActive(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <ThemeProvider><BootSplash /></ThemeProvider>;
  }

  // Password recovery outranks everything: until a new password is set, the recovery
  // session must not reach the application shell.
  if (recovering) {
    return (
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<ResetPassword />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    );
  }

  if (!session) {
    return (
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    );
  }

  // Admin-reset gate outranks role routing: until the temporary password is replaced,
  // this session must not reach any role's screens or be escapable via a typed URL —
  // there are no <Route>s rendered at all while this branch is active, so react-router
  // never gets a chance to match a deep link.
  if (mustChangePassword === null || accountActive === null) {
    return <ThemeProvider><BootSplash /></ThemeProvider>;
  }

  // A suspended account outranks the password gate: there is no point making
  // somebody choose a new password for an account that may not sign in. Like
  // the branch below it, this renders NO <Route>s at all, so a typed deep link
  // never reaches react-router.
  if (!accountActive) {
    return <ThemeProvider><SuspendedScreen /></ThemeProvider>;
  }

  if (mustChangePassword) {
    return (
      <ThemeProvider>
        <ForcePasswordChange onSuccess={() => setMustChangePassword(false)} />
      </ThemeProvider>
    );
  }

  if (!role) {
    return <ThemeProvider><NoRoleScreen /></ThemeProvider>;
  }

  const allowed = role ? ROLE_ROUTES[role] ?? ['/visitors'] : ['/visitors'];

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppShell session={session} role={role}>
          <SessionTimeout />
          {/* One page throwing must never blank the whole app — the shell (and
              with it sign-out and every other route) stays mounted. */}
          <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to={allowed[0] ?? '/visitors'} replace />} />
            {/* THE GUARD'S BROWSING SURFACES DEGRADE ONTO THE BOARD (client
                instruction, 2026-08-18: the guard must not waste time
                navigating). `/visitors`, its five segments and `/guard` were
                DISPLAY-ONLY lists — no card on them carried an action — and
                every one of them restated a list that exists somewhere a guard
                can also act: Inside is Entry & Exit's first lane, Pending
                Approval and Approved Walk-ins are dashboard tiles, and the
                Walk-in Register is /guard/walk-in.

                They REDIRECT rather than 404: these paths are in guards'
                bookmarks, and a bookmark that lands on the board is a bookmark
                that still works. Staff keep their own page here — the route was
                always two different components behind one path.

                `GuardConsole` and its segment machinery are still on disk and
                still tested; `lib/visitorSegments.ts` in particular is
                load-bearing for `guardTiles`, `gateLanes` and `useGateVisits`,
                so this is an unlinking, not a deletion. */}
            <Route path="/visitors" element={<ProtectedRoute role={role}>{role === 'guard' ? <Navigate to="/guard/dashboard" replace /> : <VisitorsDashboard />}</ProtectedRoute>} />
            <Route path="/visitors/:segment" element={<ProtectedRoute role={role}>{role === 'guard' ? <Navigate to="/guard/dashboard" replace /> : <VisitorsDashboard />}</ProtectedRoute>} />
            <Route path="/guard" element={<ProtectedRoute role={role}><Navigate to="/guard/dashboard" replace /></ProtectedRoute>} />
            <Route path="/guard/dashboard" element={<ProtectedRoute role={role}><GuardDashboard /></ProtectedRoute>} />
            <Route path="/guard/inside-now" element={<ProtectedRoute role={role}><GuardLiveQueue /></ProtectedRoute>} />
            {/* Legacy path, kept routable: /guard/live-queue is in guards'
                bookmarks and in the ?verify= links the dashboard has been
                emitting. It renders the same page rather than 404-ing. */}
            <Route path="/guard/live-queue" element={<ProtectedRoute role={role}><GuardLiveQueue /></ProtectedRoute>} />
            {/* Pre-Registered left the sidebar on 2026-08-18. Its board was
                today's approved arrivals who have not turned up yet, which is
                the dashboard's Expected Today panel from the same predicate —
                and that copy can start the check-in in place. The path stays
                routable and lands there. */}
            <Route path="/guard/preregistered" element={<ProtectedRoute role={role}><Navigate to="/guard/dashboard" replace /></ProtectedRoute>} />
            <Route path="/guard/scan-pass" element={<ProtectedRoute role={role}><GuardScanPass /></ProtectedRoute>} />
            {/* Register Walk-in — its own destination since 2026-08-15 (client
                instruction). The form was a `+` button buried in the Visitors
                tab's walk-in segment; one of the two ways a visitor enters this
                building deserves a nav item, not a disclosure triangle. */}
            <Route path="/guard/walk-in"   element={<ProtectedRoute role={role}><RegisterWalkIn /></ProtectedRoute>} />
            <Route path="/guard/pre-approvals" element={<ProtectedRoute role={role}><GuardPreApprovals /></ProtectedRoute>} />
            <Route path="/guard/search"    element={<ProtectedRoute role={role}><GuardSearch role={role} /></ProtectedRoute>} />
            <Route path="/search"          element={<ProtectedRoute role={role}><GuardSearch role={role} /></ProtectedRoute>} />
            <Route path="/kiosk"          element={<ProtectedRoute role={role}><KioskPage /></ProtectedRoute>} />
            {/* /approvals is the pre-approval FORM — the one thing on the HOD
                surface that CREATES a visit rather than deciding one, and the
                only way an HOD can raise a pre-approved visitor pass. It was
                lost when HODConsole took over both HOD routes (the console's
                "preapprovals" tab is a decision desk, not the form), which left
                an HOD with no route to invite a visitor at all. The desk now
                lives at /overview?tab=preapprovals. */}
            <Route path="/approvals"       element={<ProtectedRoute role={role}><HODApprovals /></ProtectedRoute>} />
            <Route path="/overview"        element={<ProtectedRoute role={role}><HODConsole /></ProtectedRoute>} />
            <Route path="/whos-inside"     element={<ProtectedRoute role={role}><WhosInside /></ProtectedRoute>} />
            <Route path="/reports"         element={<ProtectedRoute role={role}><ReportsPage /></ProtectedRoute>} />
            {/* The admin console's nine tabs, plus the /admin redirect, live in
                routes/adminRoutes.tsx — inlining them put this file over the
                300-line cap. They are spread into THIS `<Routes>` rather than
                nested in one of their own, so the `path="*"` fallback below
                still sees them. */}
            {adminRoutes((el) => <ProtectedRoute role={role}>{el}</ProtectedRoute>)}
            {/* The CEO's whole surface: one queue. A blacklist removal takes
                two people since migration 092 — the admin justifies it, the
                CEO grants it — and this role has no other destination, by
                scope decision. See ROLE_ROUTES.ceo. */}
            <Route path="/ceo/blacklist-removals" element={<ProtectedRoute role={role}><CeoBlacklistRemovals /></ProtectedRoute>} />
            <Route path="/profile"         element={<ProtectedRoute role={role}><ProfilePage session={session} role={role} /></ProtectedRoute>} />
            <Route path="*"                element={<NotFoundPage />} />
          </Routes>
          </RouteErrorBoundary>
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  );
}
