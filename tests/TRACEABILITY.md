# Test Traceability — goal.md §2.2 → executable checks

> Maintained by the loop (goal.md §7). Update this table in the SAME iteration as any test change.
> A §2.2 checkbox may only be ticked when every traced test for it passes.
> Status: ⏸ pending (derived, queued in `tests/pending.list`, excluded from run) · 🔴 red (ACTIVATED, failing — iteration in progress) · 🟡 todo/fixme (scaffolded, converts in its feature's iteration) · 🟢 green
> Activation = remove the file's line from `tests/pending.list` (Red step, `/tdd-loop` skill). The pre-commit hook blocks commits while anything active is red.

| Criterion | Milestone | FR / SEC tags | Test file | Layer | Status |
|---|---|---|---|---|---|
| S1 visit lifecycle logic | 🎯 A | PRD §3.2 | `tests/unit/visitLifecycle.test.ts` | unit | ⏸ |
| S1 photo pipeline math | 🎯 A | FR-CAM-08 | `tests/unit/photoCapture.test.ts` | unit | ⏸ |
| S1 walk-in flow end-to-end | 🎯 A | PRD §3.2, FR-CAM-05 | `tests/e2e/demo-path.e2e.ts` | e2e | 🟡 |
| S2a rejection | 🎯 A | PRD §3.2 | `tests/unit/visitLifecycle.test.ts`, e2e | unit+e2e | ⏸/🟡 |
| S2b escalation timers | 🏭 B | FR-VIS-07, SLA-W1 | *(to write in Milestone B)* | unit | — |
| S3 ref numbers & timestamps | 🎯 A | NFR-07 | `tests/unit/refNumber.test.ts` + `tests/security/rls.test.ts` (SEC-3) | unit+sec | 🟢/🟡 |
| S4 gate pass state machine | 🎯 A | PRD §4.4, FR-GP-06/07 | `tests/unit/gatePassStatus.test.ts` + e2e | unit+e2e | ⏸/🟡 |
| S5 RGP due/overdue | 🎯 A | FR-GP-01/02, SLA-W4 | `tests/unit/rgpDueDate.test.ts` | unit | ⏸ |
| S6 who's-inside realtime | 🎯 A | FR-VIS-01 | `tests/e2e/demo-path.e2e.ts` | e2e | 🟡 |
| S7 blacklist + recall | 🎯 A | FR-VIS-02/03 | `tests/unit/blacklist.test.ts` + e2e | unit+e2e | ⏸/🟡 |
| S8 auto-checkout day close | 🏭 B | FR-VIS-08 | `tests/unit/visitLifecycle.test.ts` (written early — pure logic) | unit | ⏸ |
| S9 backend role enforcement | 🎯 A | NFR-04, SEC-1/3/5 | `tests/security/rls.test.ts` | security | 🟡 |
| S10 photo privacy | 🎯 A | FR-CAM-13, SEC-2 | `tests/security/rls.test.ts` | security | 🟡 |
| S11 webcam resilience | 🏭 B | FR-CAM-06/10 | *(to write in Milestone B: e2e with camera denied)* | e2e | — |
| S12a visitor register | 🎯 A | FR-RPT-01 | `tests/e2e/demo-path.e2e.ts` | e2e | 🟡 |
| S12b exports & audit UI | 🏭 B | FR-RPT-05/08 | *(to write in Milestone B)* | e2e | — |
| S13a in-app notifications | 🎯 A | FR-NOT-01/02 | covered inside S1/S2a e2e (approval loop is the notification) | e2e | 🟡 |
| S13b email + stubs | 🏭 B | PRD §5 | *(to write in Milestone B)* | unit | — |
| S14 seed + demo script | 🎯 A | — | `tests/e2e/demo-path.e2e.ts` | e2e | 🟡 |
| S15 coverage targets | 🏭 B | — | this whole directory | meta | — |

## Layer commands
| Layer | Command | Cadence (goal.md §7) |
|---|---|---|
| unit | `npm test` | every iteration (hard gate) |
| security | `npm run check:security` | every iteration once schema exists (SEC-6) |
| e2e | `npm run test:e2e` | before demo dry-runs and milestone close |
| all gates | `npm run check` | before every commit |
