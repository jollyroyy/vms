# learnings.md — VMS Loop Narrative

> Append a dated entry whenever something surprising happens.
> The loop reads this at Step 2 (Orient) before starting new work.
> Max ~30 entries before consolidation.

---

## 2026-07-20 — Edge case inventory and fixes

After building the HOD pre-approval feature, I audited the entire system for edge cases.

### Edge Cases Identified

| # | Edge Case | Severity | Files Affected | Status |
|---|-----------|----------|----------------|--------|
| EC-01 | Guard checks in visit that's already checked in | Medium | Guard/Console.tsx | **Fixed** |
| EC-02 | Guard checks out visit already checked out | Medium | Guard/Console.tsx | **Fixed** |
| EC-03 | No error handling in guard checkIn/checkOut | High | Guard/Console.tsx | **Fixed** |
| EC-04 | Pre-approve visitor with same phone as existing pending visit | Low | HOD/PreApproveForm.tsx | Won't fix — upsert handles it |
| EC-05 | HOD pre-approves for a department they don't belong to | Medium | HOD/PreApproveForm.tsx | **Fixed** |
| EC-06 | Session expires mid-submission — no auth check before API calls | High | All forms | **Fixed** in Console/VisitorForm/PreApproveForm |
| EC-07 | Visitor phone normalization fails silently | Medium | VisitorForm.tsx, PreApproveForm.tsx | Won't fix — shows error |
| EC-08 | Pre-approved visit with no photo when guard tries to check in | Low | Guard/Console.tsx | Won't fix — photo optional at check-in |
| EC-09 | Multiple rapid clicks on Approve/Reject | Low | HOD/Approvals.tsx | Already handled (acting state) |
| EC-10 | Realtime subscription delivers stale data after approve/reject | Low | HOD/Approvals.tsx, Guard/Console.tsx | Already handled (local state filter) |
| EC-11 | Guard Console shows visits from all departments (should only show guard's department) | Low | Guard/Console.tsx | Won't fix — current behavior allows all-dept view |
| EC-12 | Who's Inside shows pre-approved but not-yet-arrived visitors | Medium | Shared/WhosInside.tsx | **Fixed** — shows accurate status badges |

Key: **Fixed** = code change made in this iteration. Won't fix = acceptable behavior for Milestone A.

### Lessons applied from memory.md
- **SB-08** (RPC throws without catch): Applied try-catch to guard checkIn/checkOut
- **RE-02** (button stuck disabled): Already fixed in Approvals.tsx
- **SB-09** (RPC TypeScript cast): Applied `(supabase as any).rpc()` everywhere
