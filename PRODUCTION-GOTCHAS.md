# Production Gotchas

This is an MVP for demo and self-testing on the owner's own laptop — not a
commercial release. To move fast, some corners were deliberately cut. None of
them are secret, but all of them need to be dealt with before a single real
visitor's data touches this system for real. This file is the list so nothing
gets forgotten at handoff. Each item explains the risk in plain English, why
it's fine for now, and what has to happen before going live.

## GOTCHA-1 — The face-recognition "brain" isn't licensed for a paying business

**What's the risk:** The AI model that recognises faces (from InsightFace) is
free to use for research, but its maker explicitly says the trained model
files are "available for non-commercial research purposes only." The code
around it is open-source and fine to use, but the model itself isn't cleared
for a business that charges money.

**Why it's OK right now:** Nobody is paying to use this system yet — it's a
personal demo/test, which is exactly what "non-commercial research" covers.

**What must happen before real visitors use this:** Before any money changes
hands, either buy a proper licence for this model or swap it for one that
allows commercial use (MobileFaceNet and the ONNX Model Zoo's ArcFace are both
fine for business use). All the model code lives in one file,
`src/lib/ai/faceEngine.ts`, so the swap itself is about half a day of work —
most of the time goes to re-testing accuracy, not the code change.

## GOTCHA-2 — Storing an Aadhaar number is a criminal offence

**What's the risk:** Aadhaar is India's national ID number. Storing someone's
full Aadhaar number without authorisation is a criminal offence for a private
company under the Aadhaar Act — up to 3 years in prison plus a fine of ₹1
lakh for the company. Only the last 4 digits are legally safe to keep; the
first 8 must be blanked out ("masked").

**Why it's OK right now:** The masking code already exists and has been
tested, but it is deliberately switched OFF (`VITE_ID_REDACTION=false`) so
that during development you can see the full ID extraction working and
confirm the OCR is reading it correctly.

**What must happen before real visitors use this:** Flip
`VITE_ID_REDACTION` to `true` before a single real visitor's ID document is
ever scanned. This is a one-line setting change — effort is minutes, not
hours — but it is a hard legal requirement, not optional polish.

## GOTCHA-3 — Face data needs its own consent and a deletion date

**What's the risk:** Under Indian law (the DPDP Act, 2023 — full compliance
required by 13 May 2027), a face photo counts as sensitive personal data. It
needs its own explicit "yes, you may store my face" tick box — separate from
a general "I agree to the privacy policy" checkbox — plus a promise about
when that data will be deleted.

**Why it's OK right now:** The database already has the columns to store
this (`consent_at`, `expires_at`), they're just sitting empty because no real
visitors are being processed yet.

**What must happen before real visitors use this:** Add a dedicated consent
checkbox for face capture (distinct from the general privacy consent), and
start populating a real deletion deadline for every face record. Estimated
effort: 1-2 days.

## GOTCHA-4 — All the "thinking" happens on the guard's own laptop

**What's the risk:** The AI (document reading, face matching, etc.) runs
directly in the browser on whatever computer the guard is using. If that
computer is slow, scanning will be slow, and the results will be somewhat
less accurate than a dedicated server could give.

**Why it's OK right now:** For a single-desk demo this is simpler, cheaper,
and — importantly — more private: nothing ever leaves the laptop.

**What must happen before real visitors use this:** If speed or accuracy
becomes a real problem, a server-based version can be added behind
`src/lib/ai/engine.ts` without changing any screen the guard sees. But be
honest with yourself about the trade-off: moving to a server means visitor
photos and ID images would start leaving the device over the network, which
is a new privacy exposure that simply does not exist today.

## GOTCHA-5 — The "liveness" check is weak, not real anti-spoofing

**What's the risk:** The system asks a person to blink or turn their head to
prove they're a real live person, not a photo. This will stop someone holding
up a printed photograph, but it will not reliably stop someone playing a
video of a face on a phone screen.

**Why it's OK right now:** For self-testing, nobody is actively trying to
fool the system.

**What must happen before real visitors use this:** Do not describe this
feature as "anti-spoofing" or "secure" in any marketing, signage, or
documentation. If real spoof-resistance is ever needed, that requires a
materially stronger liveness technology than what exists today — treat that
as a separate project, not a tweak.

## GOTCHA-6 — The "device lock" only identifies a machine, it doesn't secure it

**What's the risk:** Each reception computer is given an ID number that's
stored in its web browser. This is useful for answering "which computer did
this check-in happen on" — but anyone who copies that ID value could make a
different computer pretend to be the registered one. It is not a real
security barrier.

**Why it's OK right now:** For a single-location demo with a trusted guard,
this is only being used for record-keeping, not as a security gate.

**What must happen before real visitors use this:** Turn on the actual
enforcement rule already written in
`supabase/migrations/060_devices.sql` (currently dormant), AND build a way
for an admin to re-approve a guard's device when its browser data gets
cleared — otherwise a guard could get accidentally locked out mid-shift with
no way back in.

## GOTCHA-7 — Face matching will sometimes get it wrong

**What's the risk:** No face-matching technology is 100% accurate. It will
occasionally say two different people are the same person, and occasionally
fail to recognise someone it has actually seen before.

**Why it's OK right now:** It's only being used to speed up a human's
decision, never to replace one.

**What must happen before real visitors use this:** Keep it that way
permanently — a face-match score must never, by itself, open a gate or grant
access. It must always be a suggestion that a human guard confirms. This is a
policy rule, not a code change, and it should never be relaxed.

## GOTCHA-8 — The camera silently refuses to work on a plain network address

**What's the risk:** Web browsers only allow camera access on `localhost` or
on a properly secured web address (HTTPS with a real certificate). On a
address like `http://192.168.1.7:5173` — the kind you'd naturally use to
reach the laptop from another device on the network — the camera will be
silently blocked. It looks exactly like a broken camera, with no clear error
message.

**Why it's OK right now:** Testing is happening directly on the one laptop
via `localhost`, which is exempt from this restriction.

**What must happen before real visitors use this:** Any real kiosk
deployment (a separate screen or tablet at the door) needs a proper security
certificate (HTTPS) set up for its address. This is a standard but real piece
of setup work — plan for it, don't treat a "broken camera" report as a bug in
the app itself.

## GOTCHA-9 — The AI files make the app bigger and slower to deploy

**What's the risk:** The AI model files add roughly 25 MB to the project,
which makes every deployment a bit slower.

**Why it's OK right now:** 25 MB is a minor inconvenience at this stage, not
a functional problem.

**What must happen before real visitors use this:** Nothing is required —
this is optional cleanup. If deployment speed ever becomes annoying, the
model files can be moved to Supabase's file storage instead of shipping
inside the app; the security settings needed to do that already allow it.

## GOTCHA-10 — Old visitor data will never be deleted unless someone schedules it

**What's the risk:** Visitor photos and face data will accumulate forever,
taking up more and more storage, unless something actively cleans them up.

**Why it's OK right now:** Test data volume is tiny, so this hasn't mattered
yet.

**What must happen before real visitors use this:** A cleanup function
already exists at `supabase/functions/data-retention/index.ts` — it just
isn't scheduled to run. Someone needs to go into Supabase and set it up to
run automatically (e.g. nightly). Until that's done, nothing gets deleted
automatically, no matter how old it is.

## Quick checklist before going live

| Gotcha | Must be done before | Rough effort |
|---|---|---|
| GOTCHA-1 — Face model licence | Charging any money for the service | ~0.5 day |
| GOTCHA-2 — Aadhaar masking | Scanning any real visitor's ID | Minutes (flip a setting) |
| GOTCHA-3 — Face data consent & retention | Storing any real visitor's face | 1-2 days |
| GOTCHA-4 — On-device AI vs. server | Only if speed/accuracy becomes a real problem | Design decision + build |
| GOTCHA-5 — Weak liveness check | Ever calling this "anti-spoofing" | N/A — messaging/process fix |
| GOTCHA-6 — Device lock enforcement | Relying on device ID for security | Migration switch-on + admin flow |
| GOTCHA-7 — Face match is never certain | Permanently — never automate this away | N/A — policy, keep enforced |
| GOTCHA-8 — Camera needs HTTPS | Any real kiosk not on localhost | Standard HTTPS setup |
| GOTCHA-9 — Model file size | Optional, only if deploys feel slow | Small |
| GOTCHA-10 — Data retention job | Before data volume grows meaningfully | Schedule one Supabase job |
