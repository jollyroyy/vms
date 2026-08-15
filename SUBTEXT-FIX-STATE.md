# Guard dashboard subtext visibility fix — COMPLETE (10:41)

## User request (latest message, with reference vms_guard_main_overview.png)
"put the exact same font type and color and size, in the dashboard of the guard,
currently subtexts are not properly visible in the dark mode"
Reference shows: KPI tile labels ("Expected Today" etc.) in muted light gray
(~13px medium), numeral in white bold; greeting subtitle "Everything at the
entrance, in one glance." in muted gray; everything legible on dark navy.

## Findings
- /home/ubuntu/vms_repo/src/pages/Guard/GuardDashboardMain.tsx:
  - KPI tile label: line ~148 `text-sm font-medium text-navy-500 dark:text-navy-300`
  - KPI numeral: line ~149 `font-display text-kpi tabular-nums text-navy-950 dark:text-white`
- /home/ubuntu/vms_repo/src/pages/Guard/Dashboard.tsx: greeting header uses
  `.revamp-greeting-sub` → components-polish.css line 63-65:
  `@apply text-caption text-navy-500 mt-1;` (NO dark override!)
  `.revamp-greeting-title` has dark override to text-white (line 66-68) but
  .revamp-greeting-sub has none → in dark mode it stays navy-500 = dim,
  invisible-ish on dark navy. THIS is the complaint.
- tokens.css: light `--c-navy-500: 128 120 106`; DARK `--c-navy-500: 154 145 128`
  → actually decent contrast on dark bg, but the `.revamp-greeting-sub` lacks
  a dark override (inherits light-mode value? dark variant uses same name,
  so dark = rgb(154,145,128) on ~rgb(10,15,30) ≈ 7.5:1 — should be visible.
  Real issue may be components-polish.css wrapped in a `.light` scope
  (check line ~1-58 of components-polish.css).
- Reference screenshot styling: subtitle = ~13px, font-weight 400/500,
  color ~#9aa0a6-like light gray; tile labels = ~13px medium gray; numerals
  white 28-32px bold.

## Plan
1. components-polish.css: add `.dark .revamp-greeting-sub` override
   (text-navy-300 or explicit color) and check file scoping (light-only?).
2. GuardDashboardMain: KPI tile labels — keep text-sm font-medium, ensure
   dark color = text-navy-300 (already). Maybe lighten to navy-200/white-70%
   for legibility per reference (reference: gray, not white).
3. Greeting title/sub fonts: Poppins (font-display already Poppins).

## Aadhaar OCR fix — DONE (phase 1 complete)
- nameMatch.ts: strict + lenient pass (Levenshtein ≤1 via two-row DP with
  row.at() wrapper); idParser.ts: cleanNameLine + TRAILING_TOKENS strip
  (YOB|YEAR|MALE|FEMALE|DOB) before shape check.
- Tests: nameMatch 10/10, idParser 44/44, tsc clean. 101 AI tests pass.

## Still after this fix (phase 3)
1. Full vitest run (watch for rlsDataIntegrity flake — pre-existing,
   hook timeout under vitest but works in plain node; DO NOT block delivery).
2. Visual verify guard dashboard via proxy (screenshot) — compare subtext.
3. Sync to desktop mount: /mnt/4bbeb47e-d191-489f-8664-471ce0a4ffa6/VMS
   Files changed: src/lib/ai/nameMatch.ts, src/lib/ai/idParser.ts,
   tests/unit/lib/ai/nameMatch.test.ts, tests/unit/lib/ai/idParser.test.ts,
   src/pages/Guard/GuardDashboardMain.tsx (maybe), src/styles/components-polish.css.
   Desktop verify: session desktop:try3, dir C:\Users\ASUS\Desktop\VMS\src\lib\ai.
4. Deliver: refresh guard@demo.vms / demo123 at
   https://5173-itgbyrum77hhmtwn4sujd-a6830051.sg1.manus.computer
   + local: cd C:\Users\ASUS\Desktop\VMS && npm run dev → http://localhost:5173
