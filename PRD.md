# Product Requirements Document (PRD)
# VMS — Visitor & Material Gate Pass Management System
### For Mall Management Office (BMS)

| | |
|---|---|
| **Document version** | 1.1 |
| **Date** | 20 July 2026 |
| **Status** | Draft — for review |
| **Product owner** | (Mall Management Office) |

> **Requirement tagging convention:** Every trackable requirement carries an ID tag so it can be referenced in development tickets, test cases, and UAT sign-off:
> `FR-VIS-xx` visitor module · `FR-CAM-xx` photo capture · `FR-GP-xx` gate pass module · `FR-NOT-xx` notifications · `FR-RPT-xx` reports · `NFR-xx` non-functional · `SLA-xx` service levels · `HO-xx` handover items.

---

## 1. Overview

### 1.1 Problem statement
The mall management office currently manages visitor entry and material movement using paper registers. This causes:
- No verifiable record of who is inside the building at any moment
- HODs have no formal way to approve or reject a visitor before entry
- No accountability for materials (laptops, tools, spare parts, documents) entering or leaving the office
- No way to track whether items taken out ever came back (returnable items)
- Illegible/incomplete registers, impossible audits, no analytics

### 1.2 Solution
A web-based system with two integrated modules:

1. **Visitor Management (VMS)** — digital visitor registration at the security gate, HOD approval workflow, entry badge, and exit logging.
2. **Material Gate Pass (MGP)** — digital gate passes for all material movement (inward/outward, returnable/non-returnable) with department-level approval and return tracking.

### 1.3 Goals
| Goal | Success metric |
|---|---|
| 100% of visitors digitally logged | 0 paper register entries after go-live |
| HOD approval before every visitor entry | 100% of entries have an approval record |
| Full material accountability | 100% of material movement has a gate pass |
| Returnable items tracked to closure | < 5% overdue returnable passes at any time |
| Fast check-in | < 2 minutes average for walk-in visitors |
| Audit readiness | Any visit/gate pass retrievable in < 30 seconds |

### 1.4 Non-goals (out of scope for v1)
- Shopper/public footfall tracking (this system is for the **management office only**, not mall customers)
- Payroll/attendance for employees
- CCTV integration
- Physical access control hardware (turnstiles, boom barriers) — designed for later integration
- Parking management

---

## 2. Users & Roles

| Role | Who | What they do |
|---|---|---|
| **Security Guard (Gate Operator)** | Guards at the office entrance | Register walk-in visitors, capture photo/ID, print/issue badge, log entry & **exit**, verify material against gate pass at the gate |
| **HOD (Approver)** | Head of each department | Approve/reject visitor requests for their department; approve material gate passes for their department; pre-register expected visitors |
| **Department Staff (Host/Requester)** | Employees under an HOD | Can be named as the person being visited; raise material gate pass requests (approved by their HOD) |
| **Admin (BMS Manager)** | Facility/office manager | Manage departments, users, roles, blacklist; configure settings; view all reports |
| **Super Admin** | IT/system owner | Full system access, audit logs, backups, configuration |
| **Visitor** | External guest, vendor, contractor, courier | Provides their details (assisted by guard in v1; self-service QR pre-registration in v2) |

**Role rules:**
- One HOD per department; each HOD **must** name a delegate (deputy) who receives approval requests when the HOD is unavailable (leave/absent) — otherwise visitors get stuck at the gate.
- A user can hold multiple roles (e.g., Admin is also HOD of the Admin department).

---

## 3. Module 1 — Visitor Management

### 3.1 Visitor types
| Type | Behaviour |
|---|---|
| **Walk-in guest** | Standard flow: register at gate → HOD approval → entry |
| **Pre-registered guest** | HOD/staff creates the visit in advance → visitor gets a QR/OTP → fast-track check-in at gate (already approved) |
| **Vendor / Contractor** | Same as guest, plus company name, purpose category; option for multi-day pass validity |
| **Courier / Delivery** | Lightweight flow — logged by guard, no HOD approval needed (configurable); package handover recorded |
| **Government / VIP** | Flagged type; guard can escalate directly to Admin |

### 3.2 Core flow — Walk-in visitor

```
Visitor arrives at gate
        │
        ▼
[1] Security guard registers visitor
    • Reference No. (auto)   • Date & time (auto)
    • Full name              • Mobile number
    • Company/From           • Purpose of visit
    • Department to visit    • Person/HOD to meet
    • Photo (webcam capture) • Govt ID type + last 4 digits
    • Carrying material? → if yes, triggers Gate Pass flow (§4)
        │
        ▼
[2] System sends approval request to the HOD
    (in-app notification + WhatsApp/SMS/email link)
        │
        ├── HOD APPROVES ──► [3] Badge printed/issued, entry time logged,
        │                        visitor enters. Host notified "visitor on the way".
        │
        ├── HOD REJECTS ───► Guard informs visitor politely. Reason logged.
        │
        └── NO RESPONSE in X min ──► Escalate to HOD's delegate,
                                      then to Admin. Guard sees live status.
        │
        ▼
[4] Visit ends → visitor returns to gate
    • Security guard logs EXIT time & collects badge
    • HOD/host can also mark "meeting over" in the app,
      which alerts the guard to expect the visitor at the gate
        │
        ▼
[5] Visit record closed. If visitor doesn't check out by
    closing time → auto-checkout with "not verified" flag + alert to Admin
```

> **Design decision — who logs the exit:** The HOD approves entry, but the **security guard at the gate logs the physical exit** (the HOD can't see the gate). The HOD can optionally mark the meeting as finished, which notifies security. This is the standard production pattern — approval authority and physical verification are separated.

### 3.3 Pre-registration flow (Phase 2)
1. HOD or staff creates an "Expected Visitor" entry (name, phone, date, time window, purpose).
2. Visitor receives SMS/WhatsApp/email with a QR code and a link to pre-fill their own details.
3. At the gate, guard scans QR → record pops up pre-approved → photo captured → badge issued in seconds.

### 3.4 Visitor form fields

| Field | Filled by | Required | Notes |
|---|---|---|---|
| Reference No. | **System (auto)** | — | Format: `VIS-YYYYMMDD-NNNN` (resets daily) |
| Date & time in | **System (auto)** | — | Server timestamp, not editable |
| Full name | Guard (asks visitor) | ✔ | |
| Mobile number | Guard | ✔ | OTP verification in Phase 2 |
| Company / coming from | Guard | ✔ | |
| Purpose of visit | Guard | ✔ | Dropdown: Meeting / Vendor / Interview / Delivery / Maintenance / Audit / Other |
| Department | Guard | ✔ | Dropdown of departments |
| Person to meet | Guard | ✔ | Auto-populated staff list of chosen department |
| Photo | Guard (webcam) | ✔ | Live webcam capture — full spec in §3.6 (`FR-CAM`) |
| Govt ID type + last 4 digits | Guard | Configurable | **Never store full ID numbers or ID photocopies** (privacy) |
| Vehicle number | Guard | Optional | |
| Accompanying persons count | Guard | Optional | Group visits: 1 record, N badges |
| Carrying material? | Guard | ✔ (Y/N) | Yes → opens Gate Pass form pre-linked to this visit |
| Expected duration | Guard | Optional | Drives overstay alert |
| Time out | **System (auto on checkout)** | — | Logged by guard at exit |

### 3.5 Visitor features
- `FR-VIS-01` **Live "Who's inside" dashboard** — real-time list of everyone currently in the building; this doubles as the **emergency evacuation list** (printable/mobile view for fire drills).
- `FR-VIS-02` **Blacklist/watchlist** — Admin can flag persons (by phone number/name); guard gets a red alert on registration attempt.
- `FR-VIS-03` **Repeat-visitor recall** — entering a phone number auto-fills details from previous visits (photo, company), cutting check-in to seconds.
- `FR-VIS-04` **Overstay alerts** — if expected duration is exceeded, notify host & security.
- `FR-VIS-05` **Badge** — printed slip or on-screen e-badge with photo, ref no., department, validity, and QR code (QR scanned at exit for instant checkout).
- `FR-VIS-06` **Visit history** — searchable by name, phone, department, HOD, date range.
- `FR-VIS-07` **Approval escalation chain** — HOD → delegate → Admin on configurable timeout (see `SLA-W1`).
- `FR-VIS-08` **Auto-checkout at day close** with "not verified" flag + Admin alert.
- `FR-VIS-09` **Group visits** — one record, N accompanying persons, N badges.

### 3.6 Webcam photo capture — production specification (`FR-CAM`)

Photo capture is a **mandatory, first-class feature** of the guard console, not an afterthought. The badge, the HOD approval screen, repeat-visitor recall, and the blacklist alert all depend on it.

#### Hardware & environment
- `FR-CAM-01` Any standard **USB UVC webcam** works (no proprietary drivers). Minimum 720p; 1080p recommended. Mount on a small tripod/clamp at the gate desk, lens at visitor face height (~1.5 m), facing **away from windows/glare** with a plain background if possible.
- `FR-CAM-02` The guard console must also work on a **tablet using its front/rear camera** (same code path — `getUserMedia` treats both identically).
- `FR-CAM-03` Recommended gate kit: PC/tablet + webcam + thermal badge printer + UPS. The gate console is mission-critical; it must be on the UPS.

#### Software behaviour
- `FR-CAM-04` Capture via the browser **MediaDevices `getUserMedia` API**. This **requires HTTPS** — the camera API is blocked by browsers on plain HTTP. (Localhost works for development; production must be HTTPS. This is a hard deployment requirement, `NFR-04`.)
- `FR-CAM-05` **Live preview** with a face-position oval guide overlay; guard clicks **Capture**, sees the frozen frame, and can **Retake** unlimited times before saving.
- `FR-CAM-06` Camera permission is requested **once** at guard-console login, not per visitor. If permission was denied or no camera is detected, show a persistent red banner with fix instructions — never fail silently at visitor #1 of the day.
- `FR-CAM-07` **Device picker** — if multiple cameras exist, guard selects one in console settings; choice persists per device (localStorage).
- `FR-CAM-08` Capture pipeline: grab at native resolution → center-crop to **3:4 portrait** → downscale to **480×640** → encode **WebP/JPEG ~80% quality** → target **≤ 200 KB** per photo. Processing happens client-side (canvas) before upload.
- `FR-CAM-09` **Capture-to-saved in < 3 seconds** on the gate network.
- `FR-CAM-10` **Fallback chain** (the queue must never stop): webcam broken → HTML `<input type="file" capture="user">` (opens tablet/phone camera) → as last resort, Admin-configurable "photo waived" override that requires a reason and is flagged on the visit record and in reports.
- `FR-CAM-11` **Offline tolerance**: if the network drops mid-save, the photo is held in the browser (IndexedDB) and auto-synced when connectivity returns; the visit can proceed with a "photo pending sync" status.
- `FR-CAM-12` Photo is embedded in: the HOD's approval screen (they must see who they're approving), the printed/e-badge, the who's-inside dashboard, and the exit-verification screen.

#### Storage & privacy
- `FR-CAM-13` Photos stored in a **private storage bucket** (Supabase Storage), path `visits/{yyyy}/{mm}/{visit_id}.webp`. Never publicly accessible; served only via short-lived **signed URLs** to authenticated, role-authorized users.
- `FR-CAM-14` Photos fall under the same **retention policy** as visitor PII (`NFR-05`): purged/anonymized after the configured retention period (default 12 months).
- `FR-CAM-15` A visible **notice at the gate**: "Photographs are captured for security purposes only." Photos must never be used for anything except security/audit; no exports of photo galleries.
- `FR-CAM-16` v1 does **no** face recognition/matching. Face-match for repeat visitors is a Phase 4+ item, gated on a legal/consent review (see §12).

---

## 4. Module 2 — Material Gate Pass (MGP)

### 4.1 Gate pass matrix (industry-standard RGP/NRGP model)

| | **Inward** (coming in) | **Outward** (going out) |
|---|---|---|
| **Returnable (RGP)** | Vendor brings tools/equipment for a job and will take them back (e.g., contractor's drill machine, demo unit) | Office item goes out and must come back (e.g., AC unit sent for repair, laptop taken to another site) |
| **Non-Returnable (NRGP)** | Item enters permanently (e.g., purchased supplies, delivered furniture) | Item leaves permanently (e.g., scrap disposal, documents dispatched, gift/handover) |

### 4.2 Gate pass flows

**A. Visitor carrying material IN (linked to a visit):**
```
Guard ticks "carrying material" on the visitor form
 → itemized list captured (item, qty, serial no., photo optional)
 → gate pass auto-created, linked to visitor ref no.
 → concerned department HOD sees material list WITH the visitor approval request
   (one approval covers both, or HOD can approve entry but reject the material)
 → if RGP-In: at exit, guard verifies the visitor is taking the same items back
   (mismatch = alert + incident note)
```

**B. Outward material (office property going out):**
```
Department staff raises Outward Gate Pass request
 → item list, reason, carrier name, RGP or NRGP, expected return date (if RGP)
 → their HOD approves (mandatory)
 → [optional second approval by Admin/Security Head for high-value items]
 → at the gate: guard scans/enters gate pass no., physically verifies items vs list,
   marks "dispatched" with timestamp + carrier details
 → RGP only: pass stays OPEN until items return.
   Guard logs the return; system auto-reminds requester & HOD
   at due date and escalates when overdue.
```

**C. Standalone inward material (no visitor, e.g., courier delivery of goods):**
```
Guard logs Inward pass → receiving department confirms receipt in-app → closed.
```

### 4.3 Gate pass form fields

| Field | Filled by | Required |
|---|---|---|
| Gate Pass No. | **System (auto)** — `GP-IN/OUT-YYYYMMDD-NNNN` | — |
| Date & time | **System (auto)** | — |
| Type | Requester/Guard — Inward/Outward × RGP/NRGP | ✔ |
| Linked visitor ref | System (when created from a visit) | Auto |
| Department | Requester/Guard | ✔ |
| Item lines (description, qty, unit, serial/asset no., approx value, photo) | Requester/Guard | ✔ (≥1 line) |
| Reason / purpose | Requester/Guard | ✔ |
| Carrier (person/vehicle) | Guard | ✔ at gate |
| Expected return date | Requester | ✔ if RGP |
| Approver + decision + timestamp | System | Auto |
| Gate verification (guard, timestamp) | System | Auto |
| Return log (date, condition, verified by) | Guard | ✔ to close RGP |

### 4.4 Gate pass statuses
`Draft → Pending Approval → Approved → Dispatched/Received → (RGP) Awaiting Return → Partially Returned / Returned → Closed`
plus `Rejected` and `Cancelled`. **Partial returns** must be supported (3 of 5 chairs came back).

### 4.5 MGP features
- `FR-GP-01` **Open RGP register** — dashboard of all items currently out/in with due dates, color-coded overdue.
- `FR-GP-02` **Auto reminders** — T-1 day, due date, and every N days overdue → requester, HOD, Admin.
- `FR-GP-03` **Item photo capture** at gate using the same webcam pipeline as §3.6 (before/after condition for returnables).
- `FR-GP-04` **Printable gate pass** with QR code — guard scans at gate instead of typing.
- `FR-GP-05` **Mismatch handling** — guard can record quantity/item discrepancies at the gate with notes; discrepancy alerts the approving HOD.
- `FR-GP-06` **Partial returns** — per-line returned quantities; pass stays open until all lines close.
- `FR-GP-07` **Visitor-linked passes** — one HOD approval covers visitor + material; exit screen shows both.

---

## 5. Notifications

| ID | Event | Recipient | Channel |
|---|---|---|---|
| `FR-NOT-01` | Visitor awaiting approval | HOD (→ delegate → Admin on timeout) | In-app + WhatsApp/SMS + email |
| `FR-NOT-02` | Visitor approved/rejected | Guard console | In-app (real-time) |
| `FR-NOT-03` | Visitor checked in | Host/HOD | In-app + WhatsApp |
| `FR-NOT-04` | Overstay | Host + Security | In-app |
| `FR-NOT-05` | Gate pass awaiting approval | HOD | In-app + WhatsApp |
| `FR-NOT-06` | RGP due/overdue | Requester, HOD, Admin | In-app + email |
| `FR-NOT-07` | Blacklisted person attempt | Admin + Security Head | In-app + SMS |
| `FR-NOT-08` | Not-checked-out at day close | Admin | Email digest |

Approval links in WhatsApp/SMS must open a mobile page where the HOD sees the visitor's photo + details and taps **Approve / Reject** — HODs will not sit at a desktop.

---

## 6. Reports & Analytics

1. `FR-RPT-01` Daily visitor register (the digital replacement of the paper book) — exportable PDF/Excel
2. `FR-RPT-02` Visitors by department / HOD / purpose / date range
3. `FR-RPT-03` Average approval time per HOD (accountability metric, feeds `SLA-W1`/`SLA-W3`)
4. `FR-RPT-04` Currently-inside / evacuation report (live)
5. `FR-RPT-05` Gate pass register — inward/outward, RGP/NRGP filters
6. `FR-RPT-06` Open & overdue returnables report
7. `FR-RPT-07` Blacklist hit log
8. `FR-RPT-08` Full audit trail per record: every action, actor, timestamp (immutable)
9. `FR-RPT-09` Photo-waived entries report (uses of the `FR-CAM-10` override, with reasons)

---

## 7. Non-Functional Requirements

| ID | Area | Requirement |
|---|---|---|
| `NFR-01` | **Platform** | Responsive web app. Guard console optimized for desktop/tablet at the gate; HOD approval optimized for mobile |
| `NFR-02` | **Performance** | Check-in form saves < 2s; approval notification delivered < 10s; photo capture-to-save < 3s |
| `NFR-03` | **Availability** | Gate console must tolerate brief internet outages (queue & sync, incl. photos per `FR-CAM-11`) — the gate cannot stop working |
| `NFR-04` | **Security** | Role-based access control; **HTTPS mandatory** (also required for webcam API); passwords hashed; session timeout on gate console; signed URLs for photos |
| `NFR-05` | **Privacy** | Store only ID type + last 4 digits, never full govt ID numbers or scans; visitor data retention policy (default: purge/anonymize PII **and photos** after 12 months, configurable); visitor photos used only for security purposes — display a notice at the gate |
| `NFR-06` | **Audit** | All approvals/edits immutable & timestamped; no hard deletes (soft delete + audit) |
| `NFR-07` | **Timestamps** | All auto timestamps from server clock; users can never edit entry/exit times |
| `NFR-08` | **Scale (v1)** | 1 site, 1–3 gates, ~10 departments, ~100 staff, ~200 visitors/day, ~50 gate passes/day |
| `NFR-09` | **Localization** | English v1; architecture ready for a second language |
| `NFR-10` | **Backups** | Automated daily database backups, 30-day retention; storage bucket versioning for photos; restore procedure documented & tested before go-live |
| `NFR-11` | **Monitoring** | Uptime monitoring on the app + alerting to Admin/IT; error tracking (e.g., Sentry); notification-delivery failure log |
| `NFR-12` | **Browser support** | Guard console: latest Chrome/Edge (webcam reliability); HOD mobile pages: Chrome/Safari on Android/iOS |

---

## 8. Suggested Tech Stack (v1)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + Tailwind | Fast to build, responsive |
| Backend/DB | Supabase (Postgres + Auth + Realtime + Storage) | Auth, role-based rules, realtime guard console, photo storage — all built-in |
| Notifications | WhatsApp Business API / MSG91 (SMS) + email | HODs approve from phone |
| Badge/pass printing | Browser print (thermal-printer friendly CSS) | No special hardware needed v1 |
| Hosting | Vercel + Supabase cloud | Zero-ops |

### 8.1 Core data entities
`departments` · `users` (role, department, delegate_id) · `visitors` (identity, phone-keyed for recall, blacklist flag) · `visits` (ref no., visitor_id, department_id, host_id, status, in/out times, photo) · `visit_approvals` (visit_id, approver_id, decision, timestamp, reason) · `gate_passes` (pass no., type, direction, visit_id nullable, department_id, status, expected_return) · `gate_pass_items` (pass_id, description, qty, serial, value, photo, returned_qty) · `gate_pass_events` (audit trail) · `notifications` · `audit_log`

---

## 9. Release Plan

### Phase 1 — MVP (core replacement of paper registers)
- Departments, users, roles, HOD + delegate setup
- Walk-in visitor flow: guard registration → HOD mobile approval → badge → guard exit logging
- Auto ref numbers & timestamps
- Material gate pass: all 4 types, HOD approval, gate verification, RGP return tracking
- Live "who's inside" dashboard + evacuation view
- Blacklist
- In-app + email notifications
- Daily registers & basic reports

### Phase 2
- Pre-registration with QR fast-track check-in
- WhatsApp/SMS notifications & mobile approve links
- OTP phone verification for visitors
- Repeat-visitor auto-fill
- Overstay alerts, approval SLA & auto-escalation
- Badge QR scan checkout
- Analytics dashboards, partial returns UI polish

### Phase 3
- Multi-gate / multi-site support
- Access-control hardware integration (turnstile/boom barrier)
- Contractor long-term passes with validity & induction docs
- Visitor self-service kiosk mode
- Offline-first gate console

---

## 10. Service Level Agreements (SLAs)

### 10.1 System availability & recovery
| ID | Metric | Target |
|---|---|---|
| `SLA-S1` | Uptime during office hours (e.g., 8:00–22:00) | **99.5%** monthly (≤ ~2 hrs downtime/month) |
| `SLA-S2` | Uptime outside office hours | 98% (maintenance windows allowed) |
| `SLA-S3` | RPO (max data loss on disaster) | ≤ 24 hours (daily backups; point-in-time recovery if plan allows) |
| `SLA-S4` | RTO (max time to restore service) | ≤ 4 hours during office hours |
| `SLA-S5` | Planned maintenance | Outside office hours only, with **48-hour advance notice** to Admin |

### 10.2 Performance
| ID | Metric | Target |
|---|---|---|
| `SLA-P1` | Guard console page load | < 3 s |
| `SLA-P2` | Visitor check-in save | < 2 s |
| `SLA-P3` | Photo capture → saved | < 3 s |
| `SLA-P4` | Approval notification delivery | < 10 s in-app; < 60 s WhatsApp/SMS/email |
| `SLA-P5` | Report generation (1-month range) | < 10 s |

### 10.3 Workflow SLAs (business process — configurable by Admin)
| ID | Process | Target | On breach |
|---|---|---|---|
| `SLA-W1` | HOD responds to visitor approval | **5 min** | Auto-escalate to delegate; at 10 min → Admin; guard sees live countdown |
| `SLA-W2` | HOD responds to gate pass approval | 30 min | Escalate to delegate → Admin |
| `SLA-W3` | Visitor total wait at gate (walk-in) | < 10 min end-to-end | Logged; appears in "approval time per HOD" report (`FR-RPT`) |
| `SLA-W4` | RGP return follow-up | Reminder at T-1 day, due date, then every 3 days | Overdue list escalates to Admin weekly digest |
| `SLA-W5` | Not-checked-out visitors | Auto-closed at day end | Flagged + Admin digest (`FR-VIS-08`) |

### 10.4 Support SLAs (post go-live)
| Priority | Definition | Response | Resolution/workaround |
|---|---|---|---|
| **P1 — Critical** | Gate console down, check-in impossible, or approvals not reaching HODs | 30 min | 4 hours |
| **P2 — High** | A module degraded (e.g., photos not saving, badge printer flow broken) but manual workaround exists | 2 hours | 1 business day |
| **P3 — Medium** | Non-blocking bug, report error, cosmetic issue | 1 business day | 5 business days |
| **P4 — Request** | New feature / config change | 3 business days | Scheduled into next release |

- `SLA-U1` Support hours: mall office hours; **P1 gets on-call coverage 7 days/week** (the office operates on weekends — malls don't close Saturdays).
- `SLA-U2` **P1 fallback procedure**: a printed emergency paper register template is kept at the gate; entries are back-filled into the system after recovery (marked "manual entry"). The gate never stops functioning.
- `SLA-U3` Monthly service report to Admin: uptime, incident log, open tickets, SLA compliance.

---

## 11. Handover & Acceptance

### 11.1 Deliverables checklist
| ID | Deliverable |
|---|---|
| `HO-01` | Source code repository transferred (or access granted) to the mall's designated owner, with README and setup instructions |
| `HO-02` | All credentials handed over via a secure channel (password manager/vault, never email): hosting, database, storage, WhatsApp/SMS provider, domain, email sender |
| `HO-03` | Environment documentation: architecture diagram, environment variables, third-party services list with billing ownership transferred to the mall |
| `HO-04` | Database schema documentation (ERD) + data dictionary |
| `HO-05` | **Admin manual** — user management, departments, blacklist, retention settings, report exports |
| `HO-06` | **Guard quick-reference card** — laminated one-pager at the gate desk: check-in steps, photo capture, exit logging, what to do when offline/P1 (see `SLA-U2`) |
| `HO-07` | **HOD mobile guide** — one page: how approval links work, delegate setup |
| `HO-08` | Short screen-recorded training videos (guard flow, HOD flow, admin flow, gate pass flow) |
| `HO-09` | **Operations runbook**: backup verification steps, restore procedure, monitoring alerts, common issues & fixes, escalation contacts |
| `HO-10` | UAT test-case workbook with pass/fail results and sign-off sheet |

### 11.2 Acceptance process
1. `HO-11` **UAT** — scripted test cases covering every flow in §3–§5 (each test case references its `FR-*` tags). Mall nominates 1 guard, 2 HODs, 1 admin as UAT testers. Exit criteria: all P1/P2 defects fixed; P3s logged with agreed timeline.
2. `HO-12` **Pilot / parallel run** — 2 weeks running the system **alongside** the paper register at one gate. Compare completeness daily. Go/no-go review at end of week 2.
3. `HO-13` **Training** — hands-on sessions before pilot: guards (2 h, at the actual gate with the actual webcam), HODs (30 min, on their phones), Admin (2 h). Train-the-trainer: Admin can onboard future staff.
4. `HO-14` **Data seeding** — departments, staff list, HODs + delegates, blacklist import, badge/printer test, webcam positioning check (§3.6 lighting), HTTPS + domain verified.
5. `HO-15` **Go-live checklist** signed by Admin + developer; paper register formally retired (kept only as P1 fallback per `SLA-U2`).
6. `HO-16` **Hypercare** — 30 days of priority support post go-live (developer reachable during office hours, daily check-in first week).
7. `HO-17` **Warranty** — 90 days defect warranty from go-live: bugs against agreed requirements (`FR-*`/`NFR-*`) fixed at no cost. Feature changes are handled as P4 requests.
8. `HO-18` **Acceptance certificate** — formal sign-off document listing delivered requirements, known limitations, and warranty terms.

---

## 12. Long-Term Plan (12–36 months)

### Year 1 — Stabilize & complete
- Deliver Phase 2 (pre-registration QR, WhatsApp approvals, OTP, overstay alerts) and Phase 3 (multi-gate, kiosk mode, contractor long-term passes)
- Quarterly KPI reviews against §1.3 goals (approval times per HOD, overdue RGP %, check-in duration)
- Quarterly dependency/security patch cycle; annual restore drill of backups (`NFR-10`)
- Data retention job verified live (first purge at month 12, `NFR-05`/`FR-CAM-14`)

### Year 2 — Extend & integrate
- **Multi-site rollout** — same instance serving other properties/malls in the group (site-scoped roles & reports)
- **Access-control hardware** — turnstile/boom-barrier integration; badge QR opens the gate; auto exit-logging on scan-out
- **Vehicle layer** — ANPR camera at the service gate; vehicle passes linked to material gate passes
- **Tenant coordination portal** — mall tenants (shops) can pre-register their vendors/contractors visiting the management office, and fit-out material passes
- **ERP/asset integration** — gate pass items linked to the asset register; RGP auto-checks against asset IDs

### Year 3 — Optimize
- Analytics: visitor traffic heatmaps by hour/department, vendor punctuality scores, gate pass cycle-time trends
- Optional **face-match assist** for repeat visitors (`FR-CAM-16`) — only after a formal legal/consent review; explicit visitor opt-in; never silent
- Native mobile app for HODs if WhatsApp-link approvals prove limiting
- Annual third-party security review / penetration test

### Continuous (every year)
- Monthly service report (`SLA-U3`); annual SLA review & renegotiation
- Annual DR drill (restore from backup to staging)
- Annual review of retention policy against local data-protection law changes

---

## 13. Open Questions (need answers from mall management)

1. Which departments exist, and who are the HODs? (Need the org list to seed the system.)
2. Should couriers/deliveries require HOD approval or just be logged? (Recommended: just logged.)
3. Is government ID mandatory for all visitors, or only certain categories?
4. Are there high-value material thresholds that need a second approval (Admin/Security Head)?
5. Badge: printed paper slips (needs a small printer at the gate) or digital-only?
6. Data retention period required by mall policy/local law?
7. Do HODs approve on personal phones (WhatsApp) or office devices only?
8. Single gate or multiple entry points to the management office?

---

## Appendix A — Key design decisions & rationale

**Who fills the visitor form?** → **Security guard, assisted (v1).** Industry practice for facilities like this is a hybrid: the guard asks questions and types (fast, consistent data quality, handles non-tech-savvy visitors, guard verifies ID and takes the photo anyway), while frequent/expected visitors bypass typing entirely via pre-registration QR (Phase 2). Pure self-service kiosks work in corporate lobbies with receptionists nearby; at a mall management office gate with mixed visitor literacy, guard-assisted is faster and keeps the queue moving. The system should still be built so a kiosk mode can be enabled later (Phase 3).

**Who logs the exit?** → Guard logs the physical exit at the gate; HOD may mark "meeting over" as a signal. Never rely on the HOD for the actual out-time — they can't see the gate.

**Why link material passes to visits?** → One approval action for the HOD covers both the person and their materials; at exit the guard sees, on one screen, both the checkout and the returnable items to verify.

**Why auto-generated ref numbers & server timestamps?** → Tamper-proofing. Hand-written reference numbers and editable times are the #1 audit failure in paper systems.
