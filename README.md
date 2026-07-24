# SecureGate VMS - Visitor & Material Gate Pass Management

A role-based visitor management system for organizations to track visitors, manage gate passes, and monitor facility access in real time.

## Purpose

SecureGate VMS handles the full lifecycle of visitor management:
- **Pre-approval**: HODs pre-approve expected visitors
- **Check-in/out**: Guards verify and process visitors at the gate
- **Gate passes**: Track material movement (returnable & non-returnable)
- **Daily staff**: Manage recurring vendors, maids, and workers
- **Live monitoring**: Real-time dashboards showing who is inside

## User Roles

| Role | What they do |
|------|-------------|
| **Guard** | Check visitors in/out, process gate passes, monitor daily staff |
| **HOD** | Pre-approve visitors, approve gate passes, view department analytics |
| **Staff** | Request visitor passes, create gate passes |
| **Admin** | Manage users, departments, system settings, view reports |

## Application Flow

```
Visitor arrives
    |
    v
Guard checks pre-approval status
    |
    +-- Pre-approved --> Check in --> Visit in progress --> Check out
    |
    +-- Walk-in --> Guard creates walk-in request --> HOD approves/rejects
    |
    +-- Rejected --> Visitor turned away

Material Gate Pass flow:
    Staff/HOD creates gate pass (RGP or NRGP)
        |
        v
    Guard signs off at gate
        |
        +-- RGP (Returnable) --> Track return status
        +-- NRGP (Non-Returnable) --> One-way out
```

## Project Structure

```
src/
  pages/
    Guard/
      Console.tsx         # Main guard check-in/out interface
      Dashboard.tsx       # Guard KPI stats at a glance
      GatePassQueue.tsx   # Gate pass sign-off queue
      DailyStaff.tsx      # Daily vendors/maids/workers view
    HOD/
      Approvals.tsx       # Approve/reject visitor requests
      HODOverview.tsx      # Department dashboard with live stats
      PreApproveForm.tsx   # Pre-approve upcoming visitors
    Shared/
      Analytics.tsx       # Charts and analytics
      Reports.tsx         # Exportable reports
      WhosInside.tsx      # Live view of on-site visitors
      GatePassList.tsx    # Gate pass listing with filters
      GatePassForm.tsx    # Create new gate pass
      VisitorsDashboard.tsx # Visitor management for HOD/staff
    Admin/
      AdminPanel.tsx      # User and department management
      Activity.tsx        # Audit log
    Kiosk/
      Kiosk.tsx           # Self-service visitor kiosk

  components/
    layout/
      AppShell.tsx        # Main layout wrapper
      Sidebar.tsx         # Navigation sidebar (role-filtered)
      SidebarAnalytics.tsx # Real-time stats widget
      SidebarProfile.tsx  # User profile card with avatar upload
    DailyVisitors.tsx     # Daily visitor management component
    NotificationBell.tsx  # Real-time notification bell
    SessionTimeout.tsx    # Auto-logout on inactivity
    SuccessPopup.tsx      # Success confirmation modal

  lib/
    roleRoutes.ts         # Route access control (single source of truth)
    theme.ts              # Dark/light theme management
    errors.ts             # Error message helpers
    mfa.ts                # Multi-factor auth config

  types/
    index.ts              # All TypeScript types and DB schema

supabase/
  migrations/             # Numbered SQL migrations (001-031+)

tests/
  unit/                   # Component and logic tests
  security/               # RLS policies and route protection tests
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Supabase (PostgreSQL, Auth, Real-time, RLS, Storage)
- **Styling**: Tailwind CSS with custom design tokens
- **Testing**: Vitest + React Testing Library

## Key Architecture Decisions

- **Route access**: `src/lib/roleRoutes.ts` is the single source of truth for which roles can access which routes. Both the app and tests import from this file.
- **Real-time updates**: All dashboards use Supabase real-time subscriptions (`postgres_changes`) with silent refresh to avoid UI flash.
- **Row-Level Security**: All database tables use Supabase RLS policies to enforce access control at the database level.
- **Gate pass types**: RGP (Returnable Gate Pass) supports IN/OUT directions. NRGP (Non-Returnable) only supports OUT.

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npx vitest run

# Run only unit tests
npx vitest run tests/unit

# Run security tests
npx vitest run tests/security
```

## Environment

Requires a Supabase project. Set your Supabase URL and anon key in the environment or `supabaseClient.ts`.
