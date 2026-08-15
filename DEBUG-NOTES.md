# Live-queue blank-page debug notes (2026-08-14)

## Verified working
- Dashboard (/guard/dashboard) renders fully: 4 KPI tiles, live queue, ID Verification, DemoDataPanel, 6-item guard sidebar. Logged in as guard@demo.vms/demo123.
- tsc clean; 1827 tests pass (only tests/security/rlsDataIntegrity.test.ts still times out in beforeAll under vitest; passes step-by-step in plain node — DB was wiped clean by user request; pre-existing behavior, not session-introduced).
- All files synced to desktop mount /mnt/4bbeb47e-d191-489f-8664-471ce0a4ffa6/VMS including vite.config.ts (added allowedHosts) and index.css (JS comments → CSS block comment, fixed vite postcss crash).
- Public link: https://5173-itgbyrum77hhmtwn4sujd-a6830051.sg1.manus.computer

## Issue
- /guard/live-queue renders blank (root empty) in sandbox browser even after restart; module /src/pages/Guard/GuardLiveQueue.tsx fetches (106KB) and dynamically imports OK in browser console.
- Also /guard/preregistered and /guard/watchlist NOT yet visually verified.
- Next: check if this is session-storage/theme persistence issue (app is class-dark, default theme dark from ThemeProvider localStorage — page may render but body class not applied? No — root is EMPTY).
- Check App.tsx routes for GuardLiveQueue — maybe render path expects query/protected differently. Check whether the page crashes in ProtectedRoute due to role mismatch: dashboard works, so guard session OK.
- Suspect: useTodayVisits or istDateKey import inside GuardLiveQueue throws at runtime in browser (e.g. istDateKey from /src/lib/visitExpiry.ts may reference browser-unsafe code, or GuardLiveQueue uses a hook missing deps). Actually dynamic import succeeded in console, so runtime eval OK — but maybe the PAGE component throws during render (ErrorBoundary in App.tsx swallows? check App.tsx for ErrorBoundary).
- Plan: check App.tsx for error boundary swallowing; add try/error UI; check other new pages render.

## Update (09:46)
- Verified in sandbox browser: /guard/dashboard, /guard (GuardConsole), /guard/preregistered all RENDER (root len 16-19k) via SPA navigation AND full reload. Dashboard also verified visually via screenshot: correct layout, 6-link sidebar, DemoDataPanel banner present.
- Only /guard/live-queue shows blank root (len 0) after fresh reload; SPA nav to it also blank. No console errors, no unhandled rejections, main.tsx/index.css fetch 200, GuardLiveQueue.tsx transforms correctly (106KB, balanced syntax). Manual render of component (via react-dom createRoot in console) produces empty innerHTML (no error thrown).
- Hypothesis: component renders but its JSX evaluates to empty fragment/null on cold start (e.g., a state or effect path). Note earlier manual render ALSO gave len:0 even without errors => the rendered output IS empty, not a mount failure.
- Possible cause: something in GuardLiveQueue's top-level JSX returns "" — need to view the END of the file's return JSX (lines 260-380) to check for a missing closing or a `return null` path. ALSO check whether `queue` table renders but wrapped in {visitsLoading && ...} only — if visitsLoading stays true forever (e.g., supabase select on 'visits' with select(*) hanging for the guard role) page shows nothing because the only content is inside {visitsLoading && <Spinner/>} block.
- Key file paths for remaining work: src/pages/Guard/GuardLiveQueue.tsx (check line 260+ for the render block after the table), DEBUG-NOTES.md, PROGRESS-NOW.md.
- Tests: 1827 pass; only tests/security/rlsDataIntegrity.test.ts times out under vitest (pre-existing; fine in plain node). tsc clean.
- Files synced to desktop mount (UUID path /mnt/4bbeb47e-d191-489f-8664-471ce0a4ffa6/VMS): Guard pages, App.tsx, roleRoutes, navLinks, demoSeed, DemoDataPanel, index.css, tokens/components-polish css, tailwind.config, migration SQLs, test files, vite.config.ts.
- Public link: https://5173-itgbyrum77hhmtwn4sujd-a6830051.sg1.manus.computer
- User asked for localhost link: give localhost:5173 (works on user's own machine once project runs there) + this proxy link.

## RESOLVED (09:47)
The blank live-queue page was caused by a `ReferenceError` in GuardLiveQueue.tsx: the queue header used `{loading ? '…' : queue.length}` but the hook destructured the flag as `loading: visitsLoading` — the undefined `loading` identifier crashed the whole render (root stayed empty with NO console error in StrictMode HMR context, manual render also returned empty). Fixed to `{visitsLoading ? '…' : queue.length}`. tsc clean, file synced to desktop mount. Live Queue now renders (fresh reload verified via screenshot): greeting strip, Live chip + clock, Arrival Queue table with header row.

## Remaining
1. Visually verify /guard/preregistered and /guard/watchlist (both mounted correctly per earlier root-length checks, but take screenshots).
2. Seed demo visitors via DemoDataPanel on guard dashboard to populate data and confirm the queue/pre-registered cards show real seeded rows with photos. (Requires migration 078 — currently NOT run by user, DemoDataPanel shows "Demo mode unavailable".)
3. Run vitest once more after the fix (GuardLiveQueue tests) — note the live-queue unit tests may exist; check.
4. Final sync GuardLiveQueue.tsx is already synced. Then deliver: localhost:5173 link (user's own machine; currently running in sandbox) + public proxy link https://5173-itgbyrum77hhmtwn4sujd-a6830051.sg1.manus.computer (guard creds guard@demo.vms / demo123) + reminder to run migration_078_for_user.sql in Supabase SQL editor to unlock demo seeding.
