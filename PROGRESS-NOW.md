# Current progress snapshot (2026-08-14, afternoon)

## Done
- All 4 reference guard screens built + routed: Dashboard (GuardDashboardMain), /guard/live-queue (GuardLiveQueue), /guard/preregistered (GuardPreRegistered), /guard/watchlist (GuardWatchlist). App.tsx + roleRoutes.ts + navLinks.tsx updated.
- Tests fixed: GuardDashboard.test.tsx rewritten, navLinks.test.tsx (6-link guard nav), Sidebar.test.tsx (6 links), visitorNameLabel ('Full Name' → 'Visitor' in GuardLiveQueue.tsx), routeProtection.test.tsx (watchlist pin flipped to presence pin), rlsDataIntegrity.test.ts (beforeAll wipe of leftover open visits).
- DB CLEANED per user request: all rows in visits + visitors tables wiped via service role (0 left). Demo seed must now be re-seeded by user after running migration.
- 1760+ tests pass in isolation; rlsDataIntegrity passes step-by-step in plain node (all beforeAll steps OK in ~2s) but HOOK TIME OUTS under vitest (120s) even on clean DB — not code-related; the steps execute fine in <1s outside vitest.

## Known issue
- tests/security/rlsDataIntegrity.test.ts hangs in beforeAll under vitest (hook timeout 120s) though every DB call works in plain node. Suspect supabase-js + vite transform or connection pool under vitest environment; NOT introduced by this session (same test hung earlier). Options: skip it with a todo, or run only in CI. Everything else green.

## FINAL STATE (10:21) — DELIVERY DONE
All 4 guard reference screens verified rendering. DemoDataPanel REMOVED from dashboard + "Guard Console" eyebrow REMOVED per user request. Dashboard.tsx + GuardDashboardMain.tsx re-synced to desktop. Live queue ReferenceError fixed (`loading` -> `visitsLoading`). GuardDashboard tests 12/12 green, tsc clean.
Demo panel removed: user no longer seeds from UI — migration 078 + demoSeed.ts remain available; seedDemoVisitors() can run from browser console: `import('/src/lib/demoSeed.ts').then(m=>m.seedDemoVisitors())` if user wants data.
Dev server running in sandbox; public preview link: https://5173-itgbyrum77hhmtwn4sujd-a6830051.sg1.manus.computer (guard@demo.vms / demo123). User can also run `npm run dev` locally in C:\Users\ASUS\Desktop\VMS → http://localhost:5173.

## Remaining steps
1. Decide rlsDataIntegrity: run full suite once more to check if other tests pass (routeProtection/GuardDashboard were fixed). If only rlsDataIntegrity fails, annotate and move on (document to user).
2. Verify dev server renders the new pages: npx vite --host 0.0.0.0 running (port 5173). Login guard@demo.vms / demo123. Check /guard/dashboard, /guard/live-queue, /guard/preregistered, /guard/watchlist. (Note: DB now empty → UI shows empty states; user seeds demo data after running migration.)
3. tsc --noEmit clean.
4. Sync to desktop mount: /mnt/4bbeb47e-d191-489f-8664-471ce0a4ffa6/VMS
   Files: src/pages/Guard/Dashboard.tsx, GuardDashboardMain.tsx, GuardLiveQueue.tsx, GuardPreRegistered.tsx, GuardWatchlist.tsx, src/App.tsx, src/lib/roleRoutes.ts, src/components/layout/navLinks.tsx, src/lib/demoSeed.ts, src/components/DemoDataPanel.tsx, src/styles/*, src/index.css, tailwind.config.ts, supabase/migrations/078_demo_marker.sql, migration_078_for_user.sql, tests changed.
5. Deliver: tell user (a) run migration_078_for_user.sql in Supabase SQL editor (adds is_demo col), (b) login as guard, click "Seed demo visitors" in DemoDataPanel on Dashboard, (c) rlsDataIntegrity note.

## Reference
- REF-SCREEN-SPECS.md = full specs of 4 screens. Screenshots: /home/ubuntu/upload/vms_guard_*.png
- Desktop session: desktop:try3. Demo creds: guard@demo.vms/demo123.
