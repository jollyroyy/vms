# VMS Gap Analysis: SecureGate vs. Commercial VMS Products

**Date:** 2026-07-21
**Benchmarked against:** Envoy Visitors, SwipedOn, Proxyclick (Eptura Visitor), iLobby (FacilityOS), Sine (Honeywell), Greetly, Robin, Teamgo

---

## 1. MUST-HAVE Features (Present in ALL or nearly all top VMS products)

These are table-stakes features that every serious commercial VMS offers. Missing any of these would disqualify our product in a competitive evaluation.

| # | Feature | Our Status | Gap Description |
|---|---------|-----------|-----------------|
| 1.1 | **Visitor photo capture at check-in** | **Implemented** | Webcam capture with preview/retake, face-position overlay, file-input fallback. On par with commercial products. |
| 1.2 | **Host notification on visitor arrival** | **Partial** | We have in-app realtime notifications (Supabase Realtime). Commercial products all send **SMS, email, Slack, and MS Teams** notifications. We only have in-app; no SMS/email/Slack/Teams integration. |
| 1.3 | **Badge printing** | **Implemented** | QR code badge with photo, ref number, department, host, validity. Uses `window.print()` for thermal printers. Competitive with market. |
| 1.4 | **Visitor pre-registration / pre-approval** | **Implemented** | HOD/Staff can pre-approve visitors. However, we lack **visitor self-registration links** (invite URLs where the visitor fills in their own details before arrival) and **QR code pre-registration** that visitors scan on arrival. |
| 1.5 | **Digital check-in / check-out logging** | **Implemented** | Full lifecycle: pending > approved > checked_in > checked_out. Guard-operated. |
| 1.6 | **Who's Inside / evacuation view** | **Implemented** | Real-time board with live Supabase Realtime updates. Competitive feature. |
| 1.7 | **Role-based access control** | **Implemented** | Guard, HOD, Staff, Admin, Super Admin with backend-enforced RLS. Strong implementation. |
| 1.8 | **Visitor log / history search** | **Implemented** | Daily register report, searchable by name/phone/department/date. |
| 1.9 | **NDA / legal document signing** | **Implemented** | DocumentSign component with canvas signature pad. Stored as base64. Immutable after signing. |
| 1.10 | **Blacklist / watchlist** | **Partial** | We have phone-based blacklisting with reason. Commercial products (Envoy, iLobby, Sine) also offer **government watchlist screening** (OFAC, interpol), **ID document scanning**, and **facial recognition matching** against watchlists. Our implementation is manual-entry only. |
| 1.11 | **Reporting & analytics** | **Implemented** | Daily visitor register, analytics dashboard (trends, peak hours, department distribution, avg duration), CSV/JSON export. |
| 1.12 | **Repeat visitor recall** | **Implemented** | Phone number auto-fills name, company from previous visits. On par. |
| 1.13 | **Custom branding** | **Missing** | Every commercial VMS allows logo upload, color theming, and custom welcome messages on the check-in screen. We have a fixed "SecureGate" brand. No tenant-level branding customization. |
| 1.14 | **Multi-location / multi-site support** | **Missing** | All enterprise VMS products support managing multiple locations from a single dashboard. Our system is single-site only. No location/site entity in the data model. |
| 1.15 | **GDPR/CCPA compliance tools** | **Partial** | We have data retention auto-purge (365 days configurable). But we lack **visitor consent capture UI** (explicit opt-in checkboxes for data processing), **data subject access request (DSAR) workflow**, **right-to-erasure on demand**, and **privacy policy display** at check-in. |
| 1.16 | **Email notifications to hosts** | **Missing** | Every commercial product sends email when a visitor arrives. We have in-app only. Email is the baseline expectation. |

---

## 2. SHOULD-HAVE Features (Present in 3+ top products)

These features are present in the majority of commercial products and are expected by enterprise buyers.

| # | Feature | Our Status | Gap Description |
|---|---------|-----------|-----------------|
| 2.1 | **Self-service kiosk / iPad check-in** | **Missing** | Envoy, SwipedOn, iLobby, Sine, Teamgo all offer dedicated iPad/tablet kiosk mode with touchscreen-optimized UI. Our system is guard-operated only. No kiosk mode, no visitor-facing self-check-in screen. |
| 2.2 | **SMS notifications** | **Missing** | SwipedOn, Sine, Greetly, Teamgo send SMS to hosts. We have no SMS integration (no Twilio/SNS). |
| 2.3 | **Slack / MS Teams integration** | **Missing** | Envoy, SwipedOn, Greetly, Robin integrate with Slack and MS Teams for host notifications. We have none. |
| 2.4 | **ID document scanning (driver's license, passport)** | **Missing** | Envoy, iLobby, Proxyclick, Sine offer OCR scanning of government-issued ID. We capture ID type and last-4 digits manually. No OCR, no document photo capture. |
| 2.5 | **Visitor invitation emails with QR code** | **Missing** | Pre-registered visitors receive an email with a QR code they scan on arrival for instant check-in. Present in Envoy, Proxyclick, Robin, Teamgo, SwipedOn. We have pre-approval but no visitor-facing invite email or QR code for self-check-in. |
| 2.6 | **Contactless / touchless check-in** | **Missing** | Post-COVID standard. QR code scan from phone, geofencing, or mobile app check-in. Offered by Sine, Teamgo, SwipedOn, iLobby. We require guard interaction for all check-ins. |
| 2.7 | **Health screening questionnaire** | **Missing** | iLobby (FeverCheck), SwipedOn, Sine, Teamgo offer configurable health/safety screening questions before entry approval. We have no screening workflow. |
| 2.8 | **Calendar integration (Outlook, Google Calendar)** | **Missing** | Robin, Envoy, Proxyclick sync with calendar systems so meetings auto-create visitor pre-registrations. We have no calendar integration. |
| 2.9 | **Access control system integration** | **Missing** | Envoy, iLobby, Proxyclick, Sine integrate with door/turnstile/access control hardware (HID, ASSA ABLOY, Brivo) to auto-grant temporary badge access. We have no hardware integration layer. |
| 2.10 | **Custom sign-in workflows per visitor type** | **Partial** | We have a fixed form with purpose dropdown (meeting, vendor, interview, etc.). Commercial products let admins build visual workflows with conditional fields, different document requirements, and approval chains per visitor type. We have one fixed flow for all. |
| 2.11 | **Delivery / package management** | **Missing** | iLobby (Delivers), Envoy, Greetly track package/delivery arrivals separately from visitors. We have no package tracking. |
| 2.12 | **Contractor management** | **Missing** | iLobby, Sine, Teamgo have dedicated contractor flows with qualification tracking, permit management, safety induction, and compliance document collection. Our system treats all visitors the same. |
| 2.13 | **Capacity management** | **Missing** | Envoy, Proxyclick offer real-time capacity limits (e.g., max 50 visitors at a time) with auto-denial when full. We show a count on Who's Inside but have no capacity enforcement. |
| 2.14 | **Emergency / evacuation alerts** | **Partial** | We have the Who's Inside evacuation view showing all currently checked-in visitors. But commercial products (Envoy, Sine, Teamgo) also push **emergency SMS/email alerts** to all visitors and employees, with **roll-call / muster point tracking**. We only show the list. |
| 2.15 | **Audit trail / compliance log** | **Partial** | We log visit status transitions. Commercial products maintain a full immutable audit trail of every action (who approved, when badge was printed, policy versions signed, etc.) with tamper-proof timestamps. Our audit trail is implicit in status changes, not explicit. |
| 2.16 | **API / webhook integration** | **Missing** | Envoy, Proxyclick, Greetly (via Zapier), Teamgo offer REST APIs and webhooks for third-party integration. We have no public API layer or webhook system. |
| 2.17 | **Mobile app for hosts** | **Missing** | Envoy, SwipedOn, Sine have dedicated mobile apps for hosts to approve/reject visitors and receive push notifications. We have a responsive web app but no native mobile app or PWA with push notifications. |

---

## 3. NICE-TO-HAVE / Differentiators (Present in 1-2 top products)

These are innovative or specialized features that differentiate specific products.

| # | Feature | Which Product(s) | Feasibility for Us |
|---|---------|------------------|-------------------|
| 3.1 | **Facial recognition check-in** | iLobby (FaceMatch), Sine (Face Check) | **Low** -- Requires ML/AI service (AWS Rekognition, Azure Face API). Significant cost and privacy implications. Not feasible without external service. |
| 3.2 | **Geofencing auto check-in/out** | Sine, Teamgo | **Low** -- Requires native mobile app with GPS permissions. Not feasible in a web app. |
| 3.3 | **Temperature screening integration** | iLobby (FeverCheck) | **Low** -- Requires hardware (thermal camera). Declining demand post-COVID. Skip. |
| 3.4 | **Meeting room booking integration** | Robin, Proxyclick/Condeco | **Medium** -- Could integrate with Google Calendar API or MS Graph. Nice for office environments but not critical for mall management. |
| 3.5 | **Desk booking / workspace management** | Robin, Envoy | **Low** -- Outside our scope (mall management office, not hybrid workplace). |
| 3.6 | **Digital signage for room displays** | Robin | **Medium** -- Could build a TV dashboard mode for the Who's Inside view. Relatively simple. |
| 3.7 | **AI-powered anomaly detection** | Teamgo (2025 roadmap) | **Low** -- Requires significant ML infrastructure. Future consideration. |
| 3.8 | **Predictive analytics for visitor flow** | Teamgo (2025 roadmap) | **Medium** -- Could build basic predictions using historical data aggregation. Not urgent. |
| 3.9 | **Vehicle/license plate capture** | iLobby, Sine | **Medium** -- We capture vehicle info as text. OCR/camera-based plate recognition would require external service. Manual capture is sufficient for now. |
| 3.10 | **Multi-language voice announcements** | Greetly | **Low** -- Requires text-to-speech integration. Our i18n (EN/HI) covers the core need. |
| 3.11 | **Zapier / no-code integration platform** | Greetly, Envoy | **Medium** -- Would require building a webhook/event system first (see 2.16). Then Zapier integration is relatively straightforward. |
| 3.12 | **Outlook Add-In for visitor management** | Robin | **Low** -- Requires MS Office add-in development. Niche feature. |
| 3.13 | **Biometric fingerprint check-in** | Teamgo (roadmap) | **Low** -- Requires hardware. Not web-feasible. |
| 3.14 | **CRM/ERP integration** | Teamgo (roadmap) | **Medium** -- API/webhook layer (2.16) would enable this. Not urgent for mall management. |

---

## 4. Features We Have That Competitors DON'T (or rarely offer)

These are genuine differentiators in our system that most commercial VMS products do not include:

| # | Feature | Description | Competitive Advantage |
|---|---------|-------------|----------------------|
| 4.1 | **Material Gate Pass Management** | Full 4-type gate pass system (Inward/Outward x RGP/NRGP) with itemized lines, approval workflow, guard verification, and 10-status state machine. | **Strong differentiator.** No mainstream VMS includes material/asset movement tracking. This is typically a separate ERP module. Our integration of visitor + material management in one system is unique. |
| 4.2 | **Returnable Gate Pass (RGP) tracking with overdue detection** | Open-returnables dashboard with due-date tracking, color-coded overdue states, and reminder scheduling. | **Unique.** No competitor tracks returnable materials. This is valuable for manufacturing, warehouse, and mall management contexts. |
| 4.3 | **Overstay detection** | Server-side flagging of visits exceeding 9 hours with real-time UI warnings (red badge). | **Uncommon.** Most VMS products show duration but don't actively flag overstays. |
| 4.4 | **Walk-in approval flow (walkin_approved)** | Guard can fast-track a walk-in visitor with on-the-spot approval, separate from the standard HOD approval chain. | **Uncommon.** Most products have rigid approval flows. Our flexible guard override is practical for high-traffic environments. |
| 4.5 | **Duplicate active visit prevention** | Server-side trigger prevents the same phone number from having multiple active visits simultaneously. | **Uncommon.** Most products don't enforce this at the database level. |
| 4.6 | **Rate limiting on login** | Client-side rate limiting with progressive lockout (failed attempts tracking, cooldown timer). | **Basic security** that surprisingly few VMS products surface in their feature list. |
| 4.7 | **Escalation logic (HOD > Delegate > Admin)** | Time-based escalation chain with configurable thresholds (5min > 10min). | **Present in some** but our implementation is well-structured with unit-tested pure functions. |
| 4.8 | **Hindi language support** | Most VMS products support European languages; Hindi support for Indian market is a differentiator. | **Regional advantage** for Indian market deployments. |

---

## 5. CRITICAL GAPS TO FLAG

These are features that are **missing and cannot be implemented** with our current stack alone. They require external services, hardware, or significant infrastructure investment.

| # | Gap | Why It's Critical | What's Needed | Priority |
|---|-----|-------------------|--------------|----------|
| 5.1 | **Email notifications** | Table-stakes for any VMS. Hosts MUST be notified by email when a visitor arrives. Currently blocked. | Email service: **Resend, SendGrid, or AWS SES**. Supabase Edge Functions or a simple API endpoint to send transactional emails. Estimated effort: 1-2 days once service is chosen. | **P0 -- BLOCKER for production** |
| 5.2 | **SMS notifications** | Expected by 5+ of 8 benchmarked products. Mobile-first hosts need SMS. | SMS service: **Twilio, AWS SNS, or MSG91** (for India). Requires paid account and per-message cost. Estimated effort: 1 day once service is chosen. | **P1 -- High** |
| 5.3 | **ID document scanning / OCR** | Enterprise buyers expect it. Manual "last 4 digits" input is not competitive. | OCR service: **Google Vision API, AWS Textract, or Microblink**. Camera-based capture of ID card, OCR extraction of name/ID number. Estimated effort: 3-5 days. | **P2 -- Medium** |
| 5.4 | **Access control hardware integration** | Required for secure facilities. Visitor badge must open doors/turnstiles. | Hardware integration layer: **API adapter for HID, Brivo, ASSA ABLOY, or Gallagher**. Requires on-premise hardware and vendor partnerships. Estimated effort: weeks to months depending on hardware vendor. | **P3 -- Future phase** |
| 5.5 | **Push notifications (mobile)** | Needed for mobile app experience. In-app polling is not instant enough for hosts away from their desk. | Either: (a) **PWA with Web Push API** + push service (Firebase Cloud Messaging), or (b) native mobile app (React Native). PWA approach: 2-3 days. Native app: weeks. | **P1 -- High** |
| 5.6 | **Slack / MS Teams integration** | Enterprise workplace communication standard. 4+ competitors offer this. | **Slack Incoming Webhooks** (free, simple) and **MS Teams Incoming Webhooks** or **Graph API**. Estimated effort: 1-2 days per integration. | **P2 -- Medium** |
| 5.7 | **Self-service kiosk mode** | Fundamental UX paradigm difference. Guard-operated is fine for security gates; self-service is expected for office lobbies. | No external service needed -- this is a **UI/UX project**. Build a dedicated `/kiosk` route with large touch targets, auto-reset after inactivity, camera integration, and locked-down browser mode. Estimated effort: 3-5 days. | **P1 -- High** |
| 5.8 | **Multi-site / multi-tenant support** | Enterprise customers have multiple locations. Single-site is a deal-breaker for enterprise sales. | Data model change: add `site_id` to visits, departments, gate passes. RLS policies must scope by site. UI needs site switcher. Estimated effort: 3-5 days for data model + 2-3 days for UI. | **P2 -- Medium** |
| 5.9 | **Visitor self-registration (invite link + QR)** | Modern VMS flow: host pre-registers, visitor gets email with link, fills in own details, receives QR code, scans on arrival. | Requires email service (5.1) + public-facing registration page + QR code generation for visitor. No additional external service beyond email. Estimated effort: 3-4 days (after email is solved). | **P1 -- High** |
| 5.10 | **Custom branding per tenant** | White-labeling is expected for B2B SaaS. | Theme configuration table: logo URL, primary color, welcome message. CSS custom properties for runtime theming. Estimated effort: 2-3 days. | **P2 -- Medium** |

---

## Summary: Priority Roadmap

### Immediate (before production launch)
1. **Email notifications** (P0) -- unblock with Resend/SendGrid
2. **Self-service kiosk mode** (P1) -- pure frontend work
3. **SMS notifications** (P1) -- Twilio/MSG91
4. **Visitor self-registration with QR** (P1) -- depends on email
5. **Push notifications via PWA** (P1) -- Firebase Cloud Messaging

### Short-term (next quarter)
6. **Slack/Teams integration** (P2) -- webhooks
7. **ID document scanning** (P2) -- Google Vision or Microblink
8. **Multi-site support** (P2) -- data model expansion
9. **Custom branding** (P2) -- theming system
10. **GDPR compliance tools** (P2) -- consent UI, DSAR workflow
11. **Capacity management** (P2) -- max visitor limit per site

### Medium-term (6 months)
12. **API / webhook platform** -- enable third-party integrations
13. **Contractor management module** -- dedicated flows
14. **Delivery/package tracking** -- separate from visitor flow
15. **Custom sign-in workflows builder** -- visual workflow editor
16. **Full audit trail** -- immutable event log

### Long-term / evaluate
17. **Access control hardware integration** -- vendor partnerships
18. **Facial recognition** -- privacy/cost evaluation needed
19. **Native mobile app** -- React Native if PWA insufficient
20. **Geofencing** -- native app prerequisite

---

## Competitive Position Assessment

**Overall:** Our VMS is a **solid MVP** with strong core visitor management features, excellent security posture (RLS, CSP, rate limiting), and a unique Material Gate Pass module that no competitor offers. However, we are **missing critical communication channels** (email, SMS, Slack) that every commercial product provides, and we lack the **self-service paradigm** (kiosk, visitor self-registration) that defines the modern VMS experience.

**Strongest areas:** Material gate pass management, security architecture, real-time updates, approval workflows.

**Weakest areas:** External communications (email/SMS/push), self-service visitor experience, enterprise features (multi-site, branding, integrations).

**Market positioning:** With the Material Gate Pass module as a differentiator, we are best positioned for **manufacturing, warehouse, and mall management** contexts where material movement tracking is as important as visitor tracking. This is an underserved niche that pure VMS products ignore.

---

*Research sources: Product pages and reviews for Envoy, SwipedOn, Proxyclick/Eptura, iLobby/FacilityOS, Sine/Honeywell, Greetly, Robin, Teamgo; industry buyer's guides from YAROOMS, Sirix Monitoring, Skedda, Visitly, PeopleManagingPeople, Nexlar, Avigilon, ePortID (2025-2026).*
