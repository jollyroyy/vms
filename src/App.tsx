import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import type { UserRole } from './types/index';
import { ROLE_ROUTES } from './lib/roleRoutes';

// Pages
import LoginPage          from './pages/Login';
import GuardConsole       from './pages/Guard/Console';
import HODApprovals       from './pages/HOD/Approvals';
import WhosInside         from './pages/Shared/WhosInside';
import GatePassList       from './pages/Shared/GatePassList';
import GatePassForm       from './pages/Shared/GatePassForm';
import ReportsPage        from './pages/Shared/Reports';
import AdminPanel         from './pages/Admin/AdminPanel';
import NotFoundPage       from './pages/NotFound';
import Navbar             from './components/Navbar';
import SessionTimeout     from './components/SessionTimeout';

/**
 * SEC-7: Signs the user out immediately if their role is not allowed on the current route.
 * Uses ROLE_ROUTES as the single source of truth — never trusts the URL or a per-route prop.
 * Renders nothing until signOut completes to prevent flash of forbidden content.
 */
function ProtectedRoute({ children, role }: { children: React.ReactElement; role: UserRole | null }) {
  const allowed = role !== null ? (ROLE_ROUTES[role] ?? []) : [];
  const forbidden = role !== null && !allowed.some((r) => window.location.pathname.startsWith(r));
  React.useEffect(() => {
    if (forbidden) supabase.auth.signOut();
  }, [forbidden]);
  if (role === null) return null; // still loading role — render nothing
  if (forbidden) return React.createElement('div', { className: 'flex h-screen items-center justify-center text-sm text-gray-500' }, 'Signing out…');
  return children;
}

export default function App(): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole]       = useState<UserRole | null>(null);

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
      <div className="flex h-screen items-center justify-center bg-surface-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-navy-900 flex items-center justify-center animate-pulse">
            <span className="text-brand-400 font-bold text-sm">V</span>
          </div>
          <div className="h-0.5 w-16 rounded-full bg-surface-200 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-brand-500 animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const allowed = role ? ROLE_ROUTES[role] ?? ['/guard'] : ['/guard'];

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-50">
        <Navbar session={session} role={role} />
        <SessionTimeout />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          <Routes>
            <Route path="/" element={<Navigate to={allowed[0] ?? '/guard'} replace />} />
            <Route path="/guard"           element={<ProtectedRoute role={role}><GuardConsole /></ProtectedRoute>} />
            <Route path="/approvals"       element={<ProtectedRoute role={role}><HODApprovals /></ProtectedRoute>} />
            <Route path="/whos-inside"     element={<ProtectedRoute role={role}><WhosInside /></ProtectedRoute>} />
            <Route path="/gate-passes"     element={<ProtectedRoute role={role}><GatePassList /></ProtectedRoute>} />
            <Route path="/gate-passes/new" element={<ProtectedRoute role={role}><GatePassForm /></ProtectedRoute>} />
            <Route path="/reports"         element={<ProtectedRoute role={role}><ReportsPage /></ProtectedRoute>} />
            <Route path="/admin"           element={<ProtectedRoute role={role}><AdminPanel /></ProtectedRoute>} />
            <Route path="*"                element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
