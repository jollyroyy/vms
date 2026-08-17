import React from 'react';
import { Navigate, Route } from 'react-router-dom';

import AdminDashboard from '../pages/Admin/AdminDashboard';
import AdminLiveCheckIn from '../pages/Admin/AdminLiveCheckIn';
import AdminPreRegistration from '../pages/Admin/AdminPreRegistration';
import AdminVisitorsLog from '../pages/Admin/AdminVisitorsLog';
import AdminHosts from '../pages/Admin/AdminHosts';
import AdminSecurity from '../pages/Admin/AdminSecurity';
import AdminSettings from '../pages/Admin/AdminSettings';
import ActivityPage from '../pages/Admin/Activity';

// The admin console's eight routes, split out of App.tsx.
//
// THERE IS NO `/admin/badges`. The Badge Printing tab was DELETED on 2026-08-17
// (client instruction) — the page, its table, `lib/adminBadges.ts` and
// `lib/useBadgePrints.ts` are all gone, not merely unlinked, so the path 404s
// through App.tsx's `path="*"` rather than landing on a stale screen. It read
// migration 087's `badge_prints` log, which NOTHING WRITES: the gate prints a
// badge through `lib/printBadge.ts` and no path records the fact, so the tab and
// its three tiles could only ever report zero over an empty table. The migration,
// the table and the `BadgePrint` type STAY (they mirror the live schema, the same
// rule `gate_passes` follows), as do the four badge settings in Settings →
// Badges, which govern what the GATE prints and are enforced.
//
// Adding them inline pushed that file to 312 lines, and the 300-line cap has no
// exemption for a router. The split is by SURFACE — every route here belongs to
// one role's console and they were all added on one day — rather than at an
// arbitrary line, so a reader looking for an admin route has one place to look.
//
// It returns an ARRAY of `<Route>` elements rather than rendering its own
// `<Routes>`. A nested `<Routes>` would create a second matching context and
// break the `path="*"` fallback in App.tsx; React Router accepts an array of
// Route children, so spreading this into the existing `<Routes>` keeps one
// matcher for the whole app.
//
// `wrap` is App.tsx's `ProtectedRoute`, passed in rather than imported, so the
// role check stays defined in exactly one place — `lib/roleRoutes.ts` remains
// the source of truth and this file never gets its own opinion about access.
//
// `/analytics` is NOT here and is not anywhere: it was deleted on 2026-08-17
// (client instruction), and its charts moved onto the Dashboard and Reports,
// derived from the rows those screens already load.

export function adminRoutes(wrap: (el: React.ReactElement) => React.ReactElement): React.ReactElement[] {
  return [
    // `/admin` was the Admin Panel — departments and heads of department —
    // which is now the Roles & Users section of Settings. Every admin holds
    // this bookmark, so it redirects rather than 404-ing.
    <Route key="admin" path="/admin" element={<Navigate to="/admin/settings" replace />} />,

    <Route key="dashboard" path="/admin/dashboard" element={wrap(<AdminDashboard />)} />,
    <Route key="live" path="/admin/live-check-in" element={wrap(<AdminLiveCheckIn />)} />,
    <Route key="prereg" path="/admin/pre-registration" element={wrap(<AdminPreRegistration />)} />,
    <Route key="log" path="/admin/visitors-log" element={wrap(<AdminVisitorsLog />)} />,
    <Route key="hosts" path="/admin/hosts" element={wrap(<AdminHosts />)} />,
    <Route key="security" path="/admin/security" element={wrap(<AdminSecurity />)} />,
    <Route key="settings" path="/admin/settings" element={wrap(<AdminSettings />)} />,
    <Route key="activity" path="/admin/activity" element={wrap(<ActivityPage />)} />,
  ];
}
