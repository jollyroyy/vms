import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from './types/index';
import { ROLE_ROUTES } from './lib/roleRoutes';
import { ThemeProvider } from './lib/theme';

// Pages
import LoginPage          from './pages/Login';
import VisitorsDashboard  from './pages/Shared/VisitorsDashboard';
import GuardConsole       from './pages/Guard/Console';
import GuardGatePassQueue from './pages/Guard/GatePassQueue';
import HODApprovals       from './pages/HOD/Approvals';
import HODOverview        from './pages/HOD/HODOverview';
import WhosInside         from './pages/Shared/WhosInside';
import GatePassList       from './pages/Shared/GatePassList';
import GatePassForm       from './pages/Shared/GatePassForm';
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

  useEffect(() => {
    document.title = 'SecureGate — Visitor & Material Gate Pass';
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user?.app_metadata?.role) {
        setRole(data.session.user.app_metadata.role as UserRole);
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
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
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-glow ring-1 ring-white/25">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            </div>
            <p className="font-display text-sm font-bold text-navy-600 tracking-tight">SecureGate</p>
            <div className="h-1 w-20 rounded-full bg-surface-200 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-400 to-accent-500 animate-shimmer" />
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!session) {
    return (
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
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
            <Route path="/guard/gate-passes" element={<ProtectedRoute role={role}><GuardGatePassQueue /></ProtectedRoute>} />
            <Route path="/kiosk"          element={<ProtectedRoute role={role}><KioskPage /></ProtectedRoute>} />
            <Route path="/approvals"       element={<ProtectedRoute role={role}><HODApprovals /></ProtectedRoute>} />
            <Route path="/overview"        element={<ProtectedRoute role={role}><HODOverview /></ProtectedRoute>} />
            <Route path="/whos-inside"     element={<ProtectedRoute role={role}><WhosInside /></ProtectedRoute>} />
            <Route path="/gate-passes"     element={<ProtectedRoute role={role}><GatePassList /></ProtectedRoute>} />
            <Route path="/gate-passes/new" element={<ProtectedRoute role={role}><GatePassForm /></ProtectedRoute>} />
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
