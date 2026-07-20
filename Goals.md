# Goals.md — Feature Priorities & Edge-Case Catalog (compact)

> **Role of this file:** reference catalog for planning and test derivation.
> The loop is driven by [`goal.md`](goal.md) (charter) + [`PRD.md`](PRD.md) (requirements) — this file feeds them, never overrides them.
> New features enter the loop only via goal.md's Goal Amendment Protocol (§4).

---

## 1. MUST-HAVE (v1 — without these, paper is safer)

| # | Feature | PRD tag | Why it's a must |
|---|---|---|---|
| M1 | Guard walk-in registration, auto ref no. + server timestamps | §3.2, NFR-07 | Tamper-proofing; the audit core |
| M2 | HOD approve/reject + mandatory delegate → Admin escalation | FR-VIS-07, SLA-W1 | No delegate = visitor stuck at gate |
| M3 | Live approval status on guard console (realtime) | FR-NOT-02 | Guard can't phone HODs all day |
| M4 | Webcam photo + full fallback chain (file-input → waived+reason) | FR-CAM-05/06/10 | Queue must never stop on dead hardware |
| M5 | Guard-logged exit + auto-checkout at day close ("not verified") | FR-VIS-08 | Without exits, who's-inside is fiction |
| M6 | Live who's-inside dashboard (= evacuation muster list) | FR-VIS-01 | Fire-safety significance |
| M7 | Blacklist red alert at registration | FR-VIS-02 | The security head's justification |
| M8 | All 4 gate pass types + RGP open-return tracking | §4, FR-GP-01 | Returnable-never-returns is failure #1 |
| M9 | Partial returns (per-line quantities) | FR-GP-06 | Batch passes hide missing items |
| M10 | RBAC + RLS, HTTPS, immutable audit, no hard deletes | NFR-04/06, SEC-1..7 | Security baseline — never deferred |
| M11 | Daily visitor register export (PDF/Excel) | FR-RPT-01 | The auditor's paper-book replacement |
| M12 | Offline tolerance at gate (queue+sync, IndexedDB photos) + paper P1 fallback | NFR-03, FR-CAM-11, SLA-U2 | The gate cannot stop working |
| M13 | In-app + email notifications for approvals | FR-NOT-01/02 | The approval loop's transport |

## 2. SHOULD-HAVE (works without, adoption suffers daily)

| # | Feature | PRD tag |
|---|---|---|
| S1 | WhatsApp/SMS approval links (mobile page, photo + one-tap) | FR-NOT-01, §5 |
| S2 | Repeat-visitor recall by phone (auto-fill + photo) | FR-VIS-03 |
| S3 | Pre-registration + QR fast-track check-in | §3.3 |
| S4 | Overstay alerts | FR-VIS-04 |
| S5 | RGP auto-reminders (T-1, due, every N days) + Admin escalation | FR-GP-02, SLA-W4 |
| S6 | Badge QR scan checkout | FR-VIS-05 |
| S7 | Approval-time-per-HOD report | FR-RPT-03 |
| S8 | OTP phone verification | §3.4 |
| S9 | Group visits (1 record, N badges) | FR-VIS-09 |
| S10 | Photo-waived entries report | FR-RPT-09 |
| S11 | Item condition photos for returnables (before/after) | FR-GP-03 |

## 3. COULD-HAVE (defer without guilt)

Multi-gate/multi-site · self-service kiosk · contractor long-term passes · turnstile/boom-barrier integration · ANPR vehicle layer · tenant portal · ERP/asset-register link · analytics heatmaps · second language · native HOD app.

## 4. WON'T-HAVE (v1, explicit)

Shopper footfall · payroll/attendance · CCTV · parking · face recognition (legal review gate) · storing full govt ID numbers/scans — **ever**.

---

## 5. PRODUCTION / REAL-LIFE EDGE CASES

Severity: 🔴 must test when the feature is built · 🟡 backlog (list stays here until scheduled).
EC-01..EC-12 (guard console, sessions, pre-approval) are already audited in [`learnings.md`](learnings.md).

### Gate — people
- 🔴 EC-13 Visitor with no phone / shared phone (crew under supervisor's number) — recall/blacklist key breaks
- 🔴 EC-14 Blacklisted person with new phone or name-spelling variant — fuzzy match + guard manual-flag path
- 🔴 EC-15 Group of N, some leave early — partial group checkout or evacuation count lies
- 🔴 EC-16 Approved but never entered / checked out then re-enters ("forgot my bag") — define re-entry semantics
- 🟡 EC-17 VIP/govt refuses photo or ID — one-tap Admin escalation
- 🔴 EC-18 Overnight contractor vs auto-checkout at day close — legit present people must not be orphaned
- 🟡 EC-19 Host on leave / left company — stale staff list routes approval to nobody

### Approval workflow
- 🔴 EC-20 Stale approval (HOD taps link hours later, visitor gone) — approval must expire, never enable next-day check-in
- 🔴 EC-21 Double-tap Approve on laggy mobile link — idempotency (in-app already handled, EC-09)
- 🔴 EC-22 HOD approves visitor but rejects their material — split decision on linked pass (PRD §4.2A)
- 🔴 EC-23 Decision arrives while guard console offline — reconcile on reconnect
- 🔴 EC-24 Delegate and HOD both respond — first decision wins, both audit-logged
- 🟡 EC-25 HOD phone changed, notifications go to dead number — delivery-failure log (NFR-11)

### Hardware & environment
- 🟡 EC-26 Webcam glare / permission revoked by OS update — red banner (FR-CAM-06) + mounting guide
- 🔴 EC-27 Printer jam with queue — e-badge fallback is a visible button
- 🔴 EC-28 Power/network cut at gate — offline queue incl. photos (M12)
- 🔴 EC-29 Guard shift change mid-visit — guard B can check out guard A's visitor; session timeout doesn't eat in-progress form
- 🔴 EC-30 Clock skew on gate PC — audit that NO code path uses client `new Date()` for stored times

### Material gate pass
- 🔴 EC-31 Return in worse condition / wrong serial number — condition field + "returned but wrong item" mismatch
- 🔴 EC-32 Different carrier returns than dispatched — log both
- 🟡 EC-33 Return after force-closed pass — reopen/annotate path
- 🔴 EC-34 Free-text quantities ("1 lot") destroy return verification — force units
- 🟡 EC-35 High-value item under low-value description — approx-value + optional second approval (fraud vector)
- 🟡 EC-36 Multi-day job: items in with visitor A, out with visitor B

### Data, privacy, security
- 🔴 EC-37 Retention purge vs police inquiry — legal-hold flag before first purge runs
- 🔴 EC-38 State transition forced via URL/id editing — server-side validation of every transition (the iter-07..09 RPC class)
- 🟡 EC-39 Signed photo URL screenshot-leaked — short expiry
- 🟡 EC-40 Unattended logged-in console — session timeout (exists), tablet-facing-visitor posture

### Operational
- 🟡 EC-41 Weekend operation — day-close scheduling, admin availability
- 🟡 EC-42 Back-filled entries after P1 outage — "manual entry" flag so audits don't scream tampering
- 🔴 EC-43 **The bypass law**: any step slower than pen+paper gets skipped by staff — every 🔴 above needs a fast in-app path, or it becomes a workaround

---

## 6. BUILD ORDER (assumed defaults — override me)

1. **Now:** finish Milestone A (demo) per goal.md §2.2 — first unchecked 🎯 criterion, one per iteration.
2. **Next:** Milestone B hardening (🏭: escalation timers, auto-checkout, webcam resilience, exports, email). Production musts before adoption features.
3. **Then (Milestone C, via Amendment Protocol):** should-haves S1–S11, roughly in table order (WhatsApp links first — biggest adoption lever).
4. **Edge-case policy:** when an iteration builds/touches a feature, its 🔴 edge cases are derived as tests in that same iteration (per `/tdd-loop`); 🟡 stay here as backlog. After each module completes, one dedicated sweep iteration re-audits (like the EC-01..12 audit).
5. Could-haves enter only after C, one at a time, each behind its own amendment.
