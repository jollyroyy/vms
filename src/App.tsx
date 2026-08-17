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
import GuardPreRegistered   from './pages/Guard/GuardPreRegistered';
import GuardConsole       from './pages/Guard/Console';
import GuardPreApprovals  from './pages/Guard/PreApprovals';
import GuardScanPass      from './pages/Guard/ScanPass';
import RegisterWalkIn     from './pages/Guard/RegisterWalkIn';
import GuardSearch        from './pages/Guard/Search';
import WhosInside         from './pages/Shared/WhosInside';
import ReportsPage        from './pages/Shared/Reports';
import ProfilePage        from './pages/Shared/Profile';
import { adminRoutes } from './routes/adminRoutes';
import NotFoundPage       from './pages/NotFound';
import KioskPage          from './pages/Kiosk/Kiosk';
import AppShell           from './components/layout/AppShell';
import SessionTimeout     from './components/SessionTimeout';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { BootSplash, NoRoleScreen } from './components/BootScreens';
import { isUserRole, resolveUserRole } from './lib/resolveUserRole';

/**
 * SEC-7: Signs the user out immediately if their role is not allowed on the current route.
 * Uses ROLE_ROUTES as the single source of truth — never trusts the URL or a per-route prop.
 * Renders nothing until signOut completes to prevent flash of forbidden content.
 */
type MustChangePasswordRpc = (
  fn: 'my_must_change_password',
) => Promise<{ data: boolean | null; error: { message: string } | null }>;

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
  // Admin-reset gate (migration 064). `null` means "unknown / still checking" —
  // rendered as the same loading screen as `loading` so the app shell can never
  // flash before we know the answer. `false` is also the value used when there is
  // no session, or when the RPC itself fails (see checkMustChangePassword below).
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = 'Secure Gate — Visitor Management';
  }, []);

  // Asks `my_must_change_password()` (SECURITY DEFINER, scoped to auth.uid()) whether
  // this session owes a password change. Deliberately never queries `profiles` directly
  // — see CLAUDE.md's recursive-policy history on that table.
  //
  // Fail-open-but-not-silent on error: an RPC failure logs loudly to the console (so a
  // real outage or typo is visible to whoever is watching logs) but does NOT block
  // sign-in. The alternative — failing closed — would turn any transient error into an
  // outage that locks out every single existing user, which is strictly worse than the
  // temporary-password gate this feature exists to add in the first place.
  //
  // Database['public']['Functions'] is Record<string, never> (src/types/index.ts), which
  // types every supabase.rpc(name, args) call as taking `undefined`. Widening that shared
  // type ripples into postgrest-js's relationship inference elsewhere (see
  // src/pages/Admin/HodPasswordReset.tsx for the same note) — cast narrowly instead.
  //
  // INVOKED ON THE CLIENT, never lifted off it. `supabase.rpc` reads
  // `this.rest` internally, so the old `const f = supabase.rpc` made every call
  // throw "Cannot read properties of undefined (reading 'rest')" — which the
  // fail-open branch below then swallowed into a console error. The gate had
  // therefore never fired for anybody since it shipped.
  const callMustChangePassword: MustChangePasswordRpc = (fn) =>
    (supabase.rpc as unknown as MustChangePasswordRpc).call(supabase, fn);

  const checkMustChangePassword = async () => {
    setMustChangePassword(null);
    try {
      const { data, error } = await callMustChangePassword('my_must_change_password');
      if (error) {
        console.error('[VMS] my_must_change_password check failed — failing OPEN (not blocking sign-in):', error);
        setMustChangePassword(false);
        return;
      }
      setMustChangePassword(Boolean(data));
    } catch (err) {
      console.error('[VMS] my_must_change_password threw — failing OPEN (not blocking sign-in):', err);
      setMustChangePassword(false);
    }
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
      } else {
        setRole(null);
        setMustChangePassword(false);
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
        if (event === 'SIGNED_IN') void checkMustChangePassword();
      } else {
        setRole(null);
        setMustChangePassword(false);
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
  if (mustChangePassword === null) {
    return <ThemeProvider><BootSplash /></ThemeProvider>;
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
            <Route path="/visitors"       element={<ProtectedRoute role={role}>{role === 'guard' ? <GuardConsole /> : <VisitorsDashboard />}</ProtectedRoute>} />
            {/* The guard's Visitors segments — /visitors/expected, /inside, … .
                Each is a real URL so it can be bookmarked and the back button
                works between them; segmentFromSlug (lib/visitorSegments.ts)
                degrades an unknown slug onto "all" rather than 404-ing. Staff
                have no sub-nav, so they land on their own page either way. */}
            <Route path="/visitors/:segment" element={<ProtectedRoute role={role}>{role === 'guard' ? <GuardConsole /> : <VisitorsDashboard />}</ProtectedRoute>} />
            <Route path="/guard"           element={<ProtectedRoute role={role}><GuardConsole /></ProtectedRoute>} />
            <Route path="/guard/dashboard" element={<ProtectedRoute role={role}><GuardDashboard /></ProtectedRoute>} />
            <Route path="/guard/inside-now" element={<ProtectedRoute role={role}><GuardLiveQueue /></ProtectedRoute>} />
            {/* Legacy path, kept routable: /guard/live-queue is in guards'
                bookmarks and in the ?verify= links the dashboard has been
                emitting. It renders the same page rather than 404-ing. */}
            <Route path="/guard/live-queue" element={<ProtectedRoute role={role}><GuardLiveQueue /></ProtectedRoute>} />
            <Route path="/guard/preregistered" element={<ProtectedRoute role={role}><GuardPreRegistered /></ProtectedRoute>} />
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
            <Route path="/profile"         element={<ProtectedRoute role={role}><ProfilePage session={session} role={role} /></ProtectedRoute>} />
            <Route path="*"                element={<NotFoundPage />} />
          </Routes>
          </RouteErrorBoundary>
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  );
}
