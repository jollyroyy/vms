import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from './types/index';
import { ROLE_ROUTES } from './lib/roleRoutes';
import { ThemeProvider } from './lib/theme';
import Logo from './components/Logo';

// Pages
import LoginPage          from './pages/Login';
import ResetPassword      from './pages/ResetPassword';
import { hasRecoveryHash, isRecoveryPending, markRecoveryPending, clearRecoveryPending } from './lib/passwordRecovery';
import VisitorsDashboard  from './pages/Shared/VisitorsDashboard';
import GuardConsole       from './pages/Guard/Console';
import GuardDashboard     from './pages/Guard/Dashboard';
import DailyStaff         from './pages/Guard/DailyStaff';
import HODApprovals       from './pages/HOD/Approvals';
import HODOverview        from './pages/HOD/HODOverview';
import WhosInside         from './pages/Shared/WhosInside';
import ReportsPage        from './pages/Shared/Reports';
import AnalyticsPage      from './pages/Shared/Analytics';
import AdminPanel         from './pages/Admin/AdminPanel';
import ActivityPage       from './pages/Admin/Activity';
import NotFoundPage       from './pages/NotFound';
import KioskPage          from './pages/Kiosk/Kiosk';
import AppShell           from './components/layout/AppShell';
import SessionTimeout     from './components/SessionTimeout';

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

  useEffect(() => {
    document.title = 'Quest Mall Secure Gate — Visitor Management';
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Flag set but no session means the recovery session already ended (expired or
      // signed out) — drop the gate so the user isn't trapped on the reset screen.
      if (!data.session && isRecoveryPending()) {
        clearRecoveryPending();
        setRecovering(false);
      }
      setSession(data.session);
      if (data.session?.user?.app_metadata?.role) {
        setRole(data.session.user.app_metadata.role as UserRole);
      }
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
      if (s?.user?.app_metadata?.role) {
        setRole(s.user.app_metadata.role as UserRole);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <ThemeProvider>
        <div className="flex h-screen items-center justify-center bg-surface-50 relative overflow-hidden">
          <div className="aurora-stage" aria-hidden="true">
            <div className="aurora-blob aurora-blob-1" />
            <div className="aurora-blob aurora-blob-2" />
          </div>
          <div className="flex flex-col items-center gap-4 relative z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 blur-lg opacity-50 animate-pulse-soft" />
              <Logo size="lg" className="relative" />
            </div>
            <p className="font-display text-sm font-bold text-navy-600 tracking-tight">Quest Mall Secure Gate</p>
            <div className="h-1 w-20 rounded-full bg-surface-200 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-400 to-accent-500 animate-shimmer" />
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
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

  const allowed = role ? ROLE_ROUTES[role] ?? ['/visitors'] : ['/visitors'];

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppShell session={session} role={role}>
          <SessionTimeout />
          <Routes>
            <Route path="/" element={<Navigate to={allowed[0] ?? '/visitors'} replace />} />
            <Route path="/visitors"       element={<ProtectedRoute role={role}>{role === 'guard' ? <GuardConsole /> : <VisitorsDashboard />}</ProtectedRoute>} />
            <Route path="/guard"           element={<ProtectedRoute role={role}><GuardConsole /></ProtectedRoute>} />
            <Route path="/guard/dashboard" element={<ProtectedRoute role={role}><GuardDashboard /></ProtectedRoute>} />
            <Route path="/guard/daily-staff" element={<ProtectedRoute role={role}><DailyStaff /></ProtectedRoute>} />
            <Route path="/kiosk"          element={<ProtectedRoute role={role}><KioskPage /></ProtectedRoute>} />
            <Route path="/approvals"       element={<ProtectedRoute role={role}><HODApprovals /></ProtectedRoute>} />
            <Route path="/overview"        element={<ProtectedRoute role={role}><HODOverview /></ProtectedRoute>} />
            <Route path="/whos-inside"     element={<ProtectedRoute role={role}><WhosInside /></ProtectedRoute>} />
            <Route path="/reports"         element={<ProtectedRoute role={role}><ReportsPage /></ProtectedRoute>} />
            <Route path="/analytics"      element={<ProtectedRoute role={role}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/admin"           element={<ProtectedRoute role={role}><AdminPanel /></ProtectedRoute>} />
            <Route path="/admin/activity"  element={<ProtectedRoute role={role}><ActivityPage /></ProtectedRoute>} />
            <Route path="*"                element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </ThemeProvider>
  );
}
