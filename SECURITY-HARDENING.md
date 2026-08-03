# Guard-Console Hardening — findings and recommendations

Scope: stopping a **guard account from being impersonated**, and stopping a
**guard (or anyone with their credentials) from manipulating check-in / check-out
records**. Written 2026-08-03 against the live project `oxzzeonftrmohdrancex`.

Nothing in this document has been implemented. It is a proposal, ordered so the
cheap high-value items come first.

---

## 0. Two real holes found while writing this

These are not hypotheticals — they are the current state of the live database,
and they matter more than any device-binding scheme, because device binding
protects the *account* while these let anyone already holding a guard session
rewrite history.

### 0.1 Guards hold an unrestricted UPDATE on `visits`

```
policy  "visits: guard updates checkin/checkout"   cmd = UPDATE
using   current_user_role() = 'guard'
check   current_user_role() = 'guard'
```

The policy name says "checkin/checkout"; the policy body says **any column, any
row, any time**. A guard session can today:

- backdate or forward-date `checked_in_at` / `checked_out_at`
- flip a `rejected` visit to `approved` or `checked_in`
- clear `rejection_reason`, `exit_verified`, `carrying_material` or
  `carrying_remarks` on a closed visit
- silently "close" a visitor who never left

Note the asymmetry: every **HOD** write already goes through a security-definer
RPC (`approve_visit`, `reject_visit`, `cancel_visit`) precisely so a direct
UPDATE grant is not attack surface. Guards never got the same treatment.

**Fix.** Mirror the HOD pattern. Replace the blanket policy with two
security-definer RPCs and no direct UPDATE grant at all:

```sql
check_in_visit(p_visit_id uuid, p_carrying boolean, p_remarks text,
               p_photo_path text, p_photo_data text)
check_out_visit(p_visit_id uuid)
```

Each one asserts the caller's role, asserts the *current* status is a legal
predecessor (`approved`/`walkin_approved` → `checked_in` → `checked_out`), and
sets the timestamp itself. Everything else on the row stays unwritable.

### 0.2 Timestamps are supplied by the client

`CheckInPanel`, `VisitorForm`, `Kiosk` and `Console.logExit` all send
`checked_in_at: new Date().toISOString()` / `checked_out_at: …` from the
browser. The recorded arrival time is therefore whatever the device clock — or
whatever a modified request — says it is.

**Fix.** The RPCs above set `now()` server-side. The client stops sending
timestamps entirely. This is a two-line change inside each RPC and it makes the
gate register trustworthy in a way no client-side control can.

> Do 0.1 and 0.2 first. They are a day of work and they close the manipulation
> path completely. Everything below raises the cost of *stealing the account*;
> these two remove the damage that a stolen account can do to the record.

---

## 1. Device binding — the answer to "only one machine"

Yes, this is worth doing, and it is achievable in a browser. What is **not**
worth doing is the usual version of it: device fingerprints, user-agent checks,
or a UUID in `localStorage`. All three are readable and replayable by whoever
holds the session, so they stop nothing.

The one that actually works:

**Non-extractable WebCrypto keypair + server-side challenge.**

1. Admin enrols the gate device once. The browser generates an ECDSA P-256
   keypair with `extractable: false` and stores the `CryptoKey` in IndexedDB.
   A non-extractable key **cannot be read out by JavaScript** — not by the app,
   not by the console, not by an attacker with XSS. It cannot be copied to a
   second machine even by the guard themselves.
2. The public key, a label ("Main Gate — Tablet 1"), `registered_by` and
   `is_active` go into a new `gate_devices` table.
3. Every privileged call (`check_in_visit`, `check_out_visit`) takes a signature
   over a server-issued nonce. The RPC verifies it against `gate_devices` and
   rejects unknown or deactivated devices.

Properties worth stating plainly: this binds to a *browser profile on a device*,
not to hardware. Wiping the browser profile de-enrols it (which is fine — the
admin re-enrols). It survives credential theft, phishing and session-token
export, because none of those move the private key.

**Stronger, if the hardware allows it:** run the guard console as an installed
PWA on an MDM-managed tablet in kiosk mode, or put the private key behind a
platform authenticator via **WebAuthn** with `authenticatorAttachment:
"platform"` and `userVerification: "required"`. That binds to the device's
secure element and adds a biometric per action. WebAuthn is the better answer if
the gate tablets support it; the raw WebCrypto route is the fallback.

**Admin surface this needs:** a device inventory (label, last seen, last IP,
enrolled by, revoke button). Without a revoke button, a lost tablet is a
permanent hole.

---

## 2. Location — useful, but not the way it is usually sold

**Do not gate on browser geolocation.** `navigator.geolocation` is trivially
spoofed — Chrome DevTools has a location override built into the UI, and
"fake GPS" apps exist for every mobile OS. Anything you *block* on it, an
attacker simply doesn't trigger.

Use it as **evidence**, not as a gate: capture `latitude`, `longitude` and
`accuracy` on every check-in, store them on the visit, and **flag** (don't
reject) anything outside the site radius. A flagged record that an admin reviews
is worth a lot; a block that can be bypassed in ten seconds is worth nothing.

**The location control that does hold: network egress.** Restrict the guard role
to the site's egress IP range, enforced server-side. Inside a security-definer
RPC, `inet_client_addr()` is not something the client can lie about. Combined
with §1, "the guard console works only on that tablet, only on the site
network" becomes a real statement.

Caveats to plan for: a site with more than one uplink, or a 4G failover, will
change egress IP. Keep the allowlist in the `settings` table so an admin can add
a range without a deploy, and always leave an admin break-glass path that does
not depend on IP.

---

## 3. Identity and session

| Control | Status today | Recommendation |
|---|---|---|
| MFA | `src/lib/mfa.ts` exists | **Make TOTP mandatory for `guard` and `admin`**, not opt-in. Enforce at the RPC layer (`aal2` in the JWT), not just in the UI. |
| Login rate limiting | `login_attempts` table, migration 050 | Keep. Add lockout notification to admin, and rate-limit per *device* as well as per email. |
| Session lifetime | `SessionTimeout.tsx` | Shorten for `guard`. Re-authenticate (or re-verify biometric, §1) before check-out specifically — that is the action with the most incentive to falsify. |
| Shared accounts | not prevented | **One account per guard.** A shared "gate1@" login destroys attribution and makes every other control in this document unfalsifiable. This is a policy fix, not a code fix, and it is the highest-value item on this table. |
| Shift binding | none | Store the roster; have `check_in_visit` reject (or flag) a caller outside their rostered window. Catches both a stolen credential used at 3am and a guard covering their own off-shift activity. |

---

## 4. Integrity of what gets recorded

- **Photo provenance.** The visitor photo is currently a blob from
  `PhotoCapture`. Nothing stops a modified client from submitting an arbitrary
  image. Mitigations, in increasing order of effort: reject file-picker input
  and require a live `getUserMedia` stream; store a SHA-256 of the bytes on the
  visit row so later substitution is detectable; capture at the same instant as
  the geolocation reading so the two must agree.
- **Append-only audit log.** `audit_logs` exists and is already the source of
  truth for approval timestamps. Make it structurally append-only: revoke
  UPDATE and DELETE from every role including `admin`, and write rows from
  triggers rather than from the app. An audit log an admin can edit is a
  formality.
- **Record device and IP on every audit row** (`device_id`, `inet_client_addr()`).
  Without it, a confirmed manipulation cannot be attributed to a machine.
- **Hash-chain the audit log.** Each row stores `prev_hash`; a nightly job
  verifies the chain and alerts on a break. Cheap to add, and it converts
  "we think nobody edited this" into something demonstrable.

---

## 5. Detection — assume something eventually gets through

Alert an admin on:

- a check-out with implausibly short dwell time (a visitor "leaving" seconds
  after arriving is the classic way to clear a gate register)
- a check-in or check-out outside the acting guard's rostered shift
- a geolocation reading outside the site radius (§2)
- a new device enrolment, or a device seen from a new IP range
- a burst of check-ins from one guard faster than a human can process
- any failed `visits_one_open_per_visitor` violation — it means either a real
  duplicate attempt or a client bypassing the pre-check

Give the admin a **session and device inventory** page: who is logged in, on
what device, since when, with a revoke button. Most of the data is already in
`auth.sessions`.

---

## Suggested order

1. **§0.1 + §0.2** — RPC-gated check-in/out with server-side timestamps. Closes
   the actual hole. ~1 day.
2. **§3 shared accounts + mandatory MFA.** Mostly policy and config.
3. **§1 device binding** (WebAuthn platform authenticator if the tablets
   support it, non-extractable WebCrypto key otherwise) + admin device
   inventory with revoke.
4. **§2 IP allowlist** in `settings`, geolocation captured as evidence only.
5. **§4 append-only audit log + photo hash.**
6. **§5 alerting.**

Steps 1 and 2 are worth more than 3–6 combined. It is tempting to start with
device binding because it is the most visible control, but a guard with an
unrestricted UPDATE on `visits` does not need a second device to falsify the
register — they can do it from the approved one.
