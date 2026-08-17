---
marp: true
theme: default
paginate: true
style: |
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Raleway:wght@100;200;300&display=swap');

  /* ══ Gate Ops ══════════════════════════════════════════════════════════
     Palette taken from the products themselves:
       --a  #06b6d4  GatePass "Slate + Cyan Ops" primary  → MATERIAL
       --p  #e9b96b  VMS Quest gold                       → PEOPLE
       --i  #818cf8  indigo — partial / non-returnable states
     Saturated colour means status or stream. Never decoration.
     Photography is a system too: corridor = people slides,
     warehouse = material slides, architecture = the two bookends.
     ══════════════════════════════════════════════════════════════════════ */

  :root {
    --a: #06b6d4;
    --a2: #22d3ee;
    --p: #e9b96b;
    --i: #818cf8;
    --bg: #000;
    --s: #080808;
    --b: #111;
    --m: #555;
    --t: #fff;
    --g: #22c55e;
    --r: #ef4444;
    --y: #f5a623;
    --body: #999;
    --label: #666;
  }

  section {
    background: var(--bg);
    color: var(--t);
    font-family: 'Raleway', sans-serif;
    font-weight: 200;
    padding: 38px 64px;
    line-height: 1.5;
  }

  h1 { font-family: 'Outfit'; font-weight: 800; font-size: 2.15em; color: var(--t); letter-spacing: -0.03em; line-height: 1.04; margin: 0 0 4px; }
  h2 { font-family: 'Raleway'; font-weight: 100; font-size: 1.02em; color: #888; margin: 0 0 14px; }
  h3 { font-family: 'Outfit'; font-weight: 600; font-size: 0.58em; color: var(--m); text-transform: uppercase; letter-spacing: 0.2em; margin: 0 0 6px; }
  strong { color: var(--a2); font-weight: 300; }

  section.lead { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  section.lead h1 { font-size: 3.5em; }

  section::after { font-family: 'Outfit'; font-size: 0.6em; color: #1e1e1e; }

  .tag { font-family: 'Outfit'; font-weight: 600; font-size: 0.5em; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 10px; border-radius: 4px; display: inline-block; white-space: nowrap; }

  .row:hover { background: #0c0c0c; }
  .row { transition: background 0.2s; border-radius: 6px; }

  .step { flex: 1; background: var(--s); border: 1px solid var(--b); border-radius: 8px; padding: 8px 4px; text-align: center; font-family: 'Outfit'; font-weight: 600; font-size: 0.46em; letter-spacing: 0.1em; text-transform: uppercase; color: #bbb; white-space: nowrap; }
  .chev { color: #2a2a2a; font-size: 0.62em; align-self: center; }
  .quote { border-left: 2px solid var(--a); padding-left: 16px; font-family: 'Outfit'; font-weight: 400; font-size: 0.76em; color: #ddd; line-height: 1.5; }
  .lbl { font-family: 'Outfit'; font-weight: 600; font-size: 0.44em; letter-spacing: 0.2em; }
  .card { background: var(--s); border: 1px solid var(--b); border-radius: 11px; }
header: ''
footer: ''
---

<!-- _class: lead -->
<!-- _paginate: false -->

![bg brightness:0.15](https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600)

<div style="font-family:'Outfit'; font-weight:600; font-size:0.5em; letter-spacing:0.32em; color:#22d3ee; text-transform:uppercase; margin-bottom:20px;">Digital Gate Operations &amp; Movement Control Platform</div>

# ONE GATE.<br>COMPLETE VISIBILITY.

<div style="font-family:'Raleway'; font-weight:200; font-size:1em; color:#ffffffbb; margin-top:16px;">Digital Control of People, Materials &amp; Movement</div>

<div style="display:flex; align-items:center; gap:30px; margin-top:38px;">
  <div style="text-align:right; border-right:1px solid #ffffff22; padding-right:30px;"><div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e9b96b" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg><span style="font-family:'Outfit'; font-weight:600; font-size:0.48em; letter-spacing:0.24em; color:#e9b96b;">PEOPLE</span></div><div style="font-family:'Outfit'; font-weight:400; font-size:0.7em; color:#eee; margin-top:5px;">Visitor Management</div></div>
  <div style="text-align:left;"><div style="display:flex; align-items:center; gap:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg><span style="font-family:'Outfit'; font-weight:600; font-size:0.48em; letter-spacing:0.24em; color:#22d3ee;">MATERIAL</span></div><div style="font-family:'Outfit'; font-weight:400; font-size:0.7em; color:#eee; margin-top:5px;">Gate Pass Management</div></div>
</div>

<div style="font-family:'Outfit'; font-weight:400; font-size:0.44em; letter-spacing:0.2em; color:#ffffff77; margin-top:44px;">VISITOR MANAGEMENT SYSTEM &nbsp;·&nbsp; MATERIAL GATE PASS MANAGEMENT SYSTEM</div>

<!--
Open on the positioning, not the products. Say: "You have already seen both systems working.
Today is about what they do together." Hold the slide for a beat — the two streams are the
argument of the entire deck. Do not list features. Do not mention technology.
Transition: "Let's start with why the gate matters."
-->

---

### 01 · The Business Challenge

# The Gate Is Where Movement Becomes Accountability

<div style="display:flex; align-items:center; gap:9px; margin-top:14px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e9b96b" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><span class="lbl" style="color:#e9b96b;">PEOPLE</span></div>

<div style="display:flex; gap:6px; margin-top:8px;"><div class="step">Arrive</div><div class="chev">›</div><div class="step">Verify</div><div class="chev">›</div><div class="step">Entry</div><div class="chev">›</div><div class="step">Visit</div><div class="chev">›</div><div class="step">Exit</div></div>

<div style="display:flex; align-items:center; gap:9px; margin-top:18px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.6"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><span class="lbl" style="color:#22d3ee;">MATERIAL</span></div>

<div style="display:flex; gap:6px; margin-top:8px;"><div class="step">Request</div><div class="chev">›</div><div class="step">Approve</div><div class="chev">›</div><div class="step">Verify</div><div class="chev">›</div><div class="step">Gate Out</div><div class="chev">›</div><div class="step">Return</div></div>

<div class="lbl" style="color:#888; margin-top:26px;">THE CONTROL CHALLENGE</div>

<div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:9px;"><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Manual coordination</span><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Fragmented approvals</span><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Limited visibility</span><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Difficult reconciliation</span><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Delayed reporting</span></div>

<div class="quote" style="margin-top:26px;">Management needs to know <strong>who is inside</strong>, <strong>what is outside</strong>, <strong>what has returned</strong>, <strong>what is pending</strong> — and <strong>who authorized it</strong>.</div>

<!--
MEANING: both streams already follow a five-stage path. The question is whether that path
produces a record.
SAY: these are the control challenges any gate operation faces once volume grows. Frame them
as challenges the solution addresses, NOT as claims about how the client runs their gate today.
DO NOT defend the amber list if challenged — say "that is exactly what discovery would confirm."
Read the closing line slowly. It is the requirement definition for everything that follows.
Transition: "So what does good look like?"
-->

---

### 02 · The Future State

# From Gate Register to Digital Control

<div style="display:flex; gap:5px; margin-top:18px;"><div class="step" style="border-color:#06b6d433; color:#22d3ee;">Request</div><div class="chev">›</div><div class="step" style="border-color:#06b6d433; color:#22d3ee;">Approval</div><div class="chev">›</div><div class="step" style="border-color:#06b6d433; color:#22d3ee;">Verification</div><div class="chev">›</div><div class="step" style="border-color:#06b6d433; color:#22d3ee;">Gate Movement</div><div class="chev">›</div><div class="step" style="border-color:#06b6d433; color:#22d3ee;">Tracking</div><div class="chev">›</div><div class="step" style="border-color:#06b6d433; color:#22d3ee;">Closure</div><div class="chev">›</div><div class="step" style="border-color:#06b6d433; color:#22d3ee;">Visibility</div></div>

<div style="font-size:0.6em; color:#888; margin-top:10px;">One lifecycle, applied to both streams. The object changes — the discipline does not.</div>

<div style="display:flex; gap:14px; margin-top:24px;">
  <div class="card row" style="flex:1; padding:18px; position:relative; overflow:hidden;"><div style="position:absolute; top:0; left:0; width:100%; height:2px; background:linear-gradient(90deg,#e9b96b,transparent);"></div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e9b96b" stroke-width="1.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg><div class="lbl" style="color:#e9b96b; margin-top:12px;">PEOPLE</div><div style="font-family:'Outfit'; font-weight:700; font-size:0.88em; color:#fff; margin-top:5px;">Visitor Management</div><div style="font-size:0.66em; color:var(--body); margin-top:8px; line-height:1.6;">Authorization, entry and exit — recorded per visitor, attributed to an approver.</div></div>
  <div class="card row" style="flex:1; padding:18px; position:relative; overflow:hidden;"><div style="position:absolute; top:0; left:0; width:100%; height:2px; background:linear-gradient(90deg,#06b6d4,transparent);"></div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.3"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></svg><div class="lbl" style="color:#22d3ee; margin-top:12px;">MATERIAL</div><div style="font-family:'Outfit'; font-weight:700; font-size:0.88em; color:#fff; margin-top:5px;">RGP / NRGP</div><div style="font-size:0.66em; color:var(--body); margin-top:8px; line-height:1.6;">Returnable and non-returnable movement — each item traceable to a pass.</div></div>
  <div class="card row" style="flex:1; padding:18px; position:relative; overflow:hidden;"><div style="position:absolute; top:0; left:0; width:100%; height:2px; background:linear-gradient(90deg,#818cf8,transparent);"></div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="1.3"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg><div class="lbl" style="color:#818cf8; margin-top:12px;">MANAGEMENT</div><div style="font-family:'Outfit'; font-weight:700; font-size:0.88em; color:#fff; margin-top:5px;">Dashboard · Audit · Reports</div><div style="font-size:0.66em; color:var(--body); margin-top:8px; line-height:1.6;">One picture of both streams. Exceptions surfaced, not searched for.</div></div>
</div>

<div class="quote" style="margin-top:24px;">Every movement becomes <strong>authorized</strong>, <strong>traceable</strong> and <strong>visible</strong>.</div>

<!--
The conceptual heart of the deck. Walk the seven stages left to right ONCE — seven words, no
elaboration. Then land the point: "the same discipline governs a visitor and a pallet; only
the object changes."
EMPHASISE: the third card is not a report someone requests. It is a live consequence of the
first two — which is why it can be trusted.
DO NOT open a screen yet. Transition: "Here is how that is delivered."
-->

---

### 03 · The Solution

# One Platform. Two Critical Workflows.

<div style="display:flex; gap:14px; margin-top:16px;">
  <div class="card" style="flex:1; padding:16px 18px; border-top:2px solid #e9b96b;"><div class="lbl" style="color:#e9b96b;">PEOPLE MOVEMENT</div><div style="font-family:'Outfit'; font-weight:700; font-size:0.98em; color:#fff; margin-top:6px;">Visitor Management System</div><div style="font-size:0.62em; color:var(--label); margin-top:3px;">Who enters, on whose authority, and when they leave</div><div style="display:flex; gap:4px; margin-top:14px;"><div class="step" style="border-color:#e9b96b22; color:#e9b96b;">Pre-reg</div><div class="step" style="border-color:#e9b96b22; color:#e9b96b;">Approve</div><div class="step" style="border-color:#e9b96b22; color:#e9b96b;">Verify</div><div class="step" style="border-color:#e9b96b22; color:#e9b96b;">Check-in</div><div class="step" style="border-color:#e9b96b22; color:#e9b96b;">Track</div><div class="step" style="border-color:#e9b96b22; color:#e9b96b;">Check-out</div></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em; margin-top:12px;"><span style="flex:1; color:#ddd;">Controlled Access</span><span style="color:var(--label);">Host-approved entry only</span></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em;"><span style="flex:1; color:#ddd;">Visitor Visibility</span><span style="color:var(--label);">Expected · inside · departed</span></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em;"><span style="flex:1; color:#ddd;">Faster Gate Operations</span><span style="color:var(--label);">Pre-approved arrivals</span></div><div class="row" style="display:flex; padding:7px 0; font-size:0.64em;"><span style="flex:1; color:#ddd;">Complete Visitor History</span><span style="color:var(--label);">Searchable, exportable</span></div></div>
  <div class="card" style="flex:1; padding:16px 18px; border-top:2px solid #06b6d4;"><div class="lbl" style="color:#22d3ee;">MATERIAL MOVEMENT</div><div style="font-family:'Outfit'; font-weight:700; font-size:0.98em; color:#fff; margin-top:6px;">Material Gate Pass Management</div><div style="font-size:0.62em; color:var(--label); margin-top:3px;">What leaves, on whose authority, and what must come back</div><div style="display:flex; gap:4px; margin-top:14px;"><div class="step" style="border-color:#06b6d422; color:#22d3ee;">Request</div><div class="step" style="border-color:#06b6d422; color:#22d3ee;">Approve</div><div class="step" style="border-color:#06b6d422; color:#22d3ee;">Gate Out</div><div class="step" style="border-color:#06b6d422; color:#22d3ee;">Track</div><div class="step" style="border-color:#06b6d422; color:#22d3ee;">Return</div><div class="step" style="border-color:#06b6d422; color:#22d3ee;">Reconcile</div></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em; margin-top:12px;"><span style="flex:1; color:#ddd;">Material Authorization</span><span style="color:var(--label);">Department-head raised</span></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em;"><span style="flex:1; color:#ddd;">Gate Verification</span><span style="color:var(--label);">Physically checked, logged</span></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em;"><span style="flex:1; color:#ddd;">RGP Accountability</span><span style="color:var(--label);">Returns tracked per line</span></div><div class="row" style="display:flex; padding:7px 0; font-size:0.64em;"><span style="flex:1; color:#ddd;">NRGP Traceability</span><span style="color:var(--label);">Permanent exit on record</span></div></div>
</div>

<div class="quote" style="margin-top:20px;">Together, the two systems create a <strong>single digital view of movement</strong> through the organization's gates.</div>

<!--
Two cards, one sentence each — do NOT read the tables aloud, they are there for the people who
read ahead.
SAY: "Same six stages, same approval discipline, same audit trail. One is people, one is material."
If asked about integration: both systems share one identity and role model, so a person's
authority is defined once. Do not promise data merges beyond that.
Transition: "Let's take each in turn, starting with people."
-->

---

### 04 · People Movement

![bg brightness:0.06](https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600)

# Visitor Management

## Controlled people movement — authorization through exit

<div style="display:flex; gap:22px; margin-top:4px;">
  <div style="flex:1.05;"><div class="row" style="display:flex; align-items:baseline; gap:12px; border-left:2px solid #e9b96b44; padding:6px 0 6px 14px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.48em; color:#e9b96b; width:20px;">01</span><span style="font-size:0.72em; color:#eee;">Pre-registration</span><span style="margin-left:auto; font-size:0.58em; color:var(--label);">Raised in advance</span></div><div class="row" style="display:flex; align-items:baseline; gap:12px; border-left:2px solid #e9b96b44; padding:6px 0 6px 14px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.48em; color:#e9b96b; width:20px;">02</span><span style="font-size:0.72em; color:#eee;">Host Approval</span><span style="margin-left:auto; font-size:0.58em; color:var(--label);">Named authorizer</span></div><div class="row" style="display:flex; align-items:baseline; gap:12px; border-left:2px solid #e9b96b44; padding:6px 0 6px 14px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.48em; color:#e9b96b; width:20px;">03</span><span style="font-size:0.72em; color:#eee;">Visitor Arrival</span><span style="margin-left:auto; font-size:0.58em; color:var(--label);">Expected at the gate</span></div><div class="row" style="display:flex; align-items:baseline; gap:12px; border-left:2px solid #e9b96b44; padding:6px 0 6px 14px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.48em; color:#e9b96b; width:20px;">04</span><span style="font-size:0.72em; color:#eee;">Identity Verification</span><span style="margin-left:auto; font-size:0.58em; color:var(--label);">ID checked at entry</span></div><div class="row" style="display:flex; align-items:baseline; gap:12px; border-left:2px solid #e9b96b44; padding:6px 0 6px 14px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.48em; color:#e9b96b; width:20px;">05</span><span style="font-size:0.72em; color:#eee;">Check-in</span><span style="margin-left:auto; font-size:0.58em; color:var(--label);">Visit becomes active</span></div><div class="row" style="display:flex; align-items:baseline; gap:12px; border-left:2px solid #e9b96b44; padding:6px 0 6px 14px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.48em; color:#e9b96b; width:20px;">06</span><span style="font-size:0.72em; color:#eee;">Visit</span><span style="margin-left:auto; font-size:0.58em; color:var(--label);">Visible as on site</span></div><div class="row" style="display:flex; align-items:baseline; gap:12px; border-left:2px solid #e9b96b44; padding:6px 0 6px 14px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.48em; color:#e9b96b; width:20px;">07</span><span style="font-size:0.72em; color:#eee;">Check-out</span><span style="margin-left:auto; font-size:0.58em; color:var(--label);">Closed and recorded</span></div></div>
  <div style="flex:1;"><div class="lbl" style="color:#555; margin-bottom:9px;">MANAGEMENT VISIBILITY</div><div style="display:flex; flex-wrap:wrap; gap:6px;"><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Expected</span><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Currently Inside</span><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Checked Out</span><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Pending Approvals</span><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Visitor History</span><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Exceptions</span><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Declined Entries</span><span class="tag" style="background:#0a0a0a; color:#bbb; border:1px solid #1a1a1a;">Audit Trail</span></div><div style="margin-top:16px; border:1px dashed #06b6d444; border-radius:10px; padding:24px 16px; text-align:center; background:#04080a;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.3"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><div style="font-family:'Outfit'; font-weight:600; font-size:0.5em; letter-spacing:0.2em; color:#22d3ee; margin-top:10px;">INSERT ACTUAL VMS SCREENSHOT</div><div style="font-size:0.58em; color:#888; margin-top:6px; line-height:1.6;">Guard dashboard — Expected · Checked In<br>In Premises · Checked Out · Overstaying</div><div style="margin-top:10px;"><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Capture before presentation</span></div></div></div>
</div>

<!--
MEANING: this is not a register. It is control of a lifecycle.
SAY, close to verbatim: "The objective is not simply to register visitors. It is to control the
visitor lifecycle from authorization through exit, while giving management visibility into what
is happening at the gate."
EMPHASISE: every visit carries a named approver, and the exit is recorded rather than assumed.
DO NOT explain individual screens, field-level detail, or the scanner.
Transition: "Material movement follows the same discipline — with one extra obligation."
-->

---

### 05 · Material Movement

![bg brightness:0.06](https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600)

# Material Gate Pass

## Controlled material movement — does it come back?

<div style="display:flex; gap:14px; margin-top:4px;">
  <div class="card" style="flex:1; padding:16px 18px; border-top:2px solid #06b6d4;"><div style="display:flex; align-items:center; gap:9px;"><span class="tag" style="background:#06b6d418; color:#22d3ee; border:1px solid #06b6d433;">RGP</span><span style="font-family:'Outfit'; font-weight:600; font-size:0.56em; color:#888; letter-spacing:0.06em;">RETURNABLE GATE PASS</span></div><div style="font-size:0.66em; color:var(--body); margin-top:10px; line-height:1.6;">Material is expected to return — and the pass stays open until it does.</div><div style="display:flex; gap:4px; margin-top:14px;"><div class="step">Request</div><div class="step">Approve</div><div class="step">Gate Out</div><div class="step">Outside</div><div class="step">Return</div><div class="step">Closed</div></div><div class="row" style="display:flex; align-items:center; gap:9px; padding:8px 0; border-bottom:1px solid #111; font-size:0.66em; color:#ddd; margin-top:14px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>Know what went out</div><div class="row" style="display:flex; align-items:center; gap:9px; padding:8px 0; border-bottom:1px solid #111; font-size:0.66em; color:#ddd;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>Know what came back</div><div class="row" style="display:flex; align-items:center; gap:9px; padding:8px 0; font-size:0.66em; color:#ddd;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>Know what remains outstanding</div></div>
  <div class="card" style="flex:1; padding:16px 18px; border-top:2px solid #818cf8;"><div style="display:flex; align-items:center; gap:9px;"><span class="tag" style="background:#818cf818; color:#818cf8; border:1px solid #818cf833;">NRGP</span><span style="font-family:'Outfit'; font-weight:600; font-size:0.56em; color:#888; letter-spacing:0.06em;">NON-RETURNABLE GATE PASS</span></div><div style="font-size:0.66em; color:var(--body); margin-top:10px; line-height:1.6;">Material is not expected to return — so authorization at the gate is the control.</div><div style="display:flex; gap:4px; margin-top:14px;"><div class="step">Request</div><div class="step">Approve</div><div class="step">Verify</div><div class="step">Gate Out</div><div class="step">Clear</div><div class="step">Closed</div></div><div class="row" style="display:flex; align-items:center; gap:9px; padding:8px 0; border-bottom:1px solid #111; font-size:0.66em; color:#ddd; margin-top:14px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>Authorized — raised by a department head</div><div class="row" style="display:flex; align-items:center; gap:9px; padding:8px 0; border-bottom:1px solid #111; font-size:0.66em; color:#ddd;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>Verified — physically checked at the gate</div><div class="row" style="display:flex; align-items:center; gap:9px; padding:8px 0; font-size:0.66em; color:#ddd;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>Traceable — permanent exit on record</div></div>
</div>

<div class="quote" style="margin-top:20px;"><strong>RGP controls returnability. NRGP controls permanent outward movement.</strong></div>

<!--
MEANING: two different obligations, deliberately not one dropdown.
SAY: "A gate pass answers one question — does this come back? RGP keeps an obligation open.
NRGP closes it at the gate."
ONLY IF ASKED: inbound returnable movement is handled too — a contractor's own equipment coming
in and going back out.
DO NOT explain pass numbering, direction flags, or anything about the database.
Transition: "Rather than describe this further, let's watch it happen."
-->

---

### 06 · Live Demonstration

![bg brightness:0.05](https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600)

# One Visitor. End to End.

<div style="margin-top:12px;"><span class="tag" style="background:#e9b96b12; color:#e9b96b; border:1px solid #e9b96b26; font-size:0.56em; padding:5px 14px;">Scenario · A vendor is scheduled to meet the HR Head</span></div>

<div style="display:flex; gap:22px; margin-top:18px;">
  <div style="flex:1.15;"><div class="row" style="display:flex; align-items:center; gap:14px; padding:7px 0;"><span style="font-family:'Outfit'; font-weight:800; font-size:0.68em; color:#3a3a3a; width:34px;">01</span><span style="font-size:0.72em; color:#fff; width:120px;">Pre-register</span><span style="font-size:0.6em; color:var(--body);">Visitor details captured</span></div><div class="row" style="display:flex; align-items:center; gap:14px; padding:7px 0;"><span style="font-family:'Outfit'; font-weight:800; font-size:0.68em; color:#3a3a3a; width:34px;">02</span><span style="font-size:0.72em; color:#fff; width:120px;">Approve</span><span style="font-size:0.6em; color:var(--body);">Host authorizes the visit</span></div><div class="row" style="display:flex; align-items:center; gap:14px; padding:7px 0;"><span style="font-family:'Outfit'; font-weight:800; font-size:0.68em; color:#3a3a3a; width:34px;">03</span><span style="font-size:0.72em; color:#fff; width:120px;">Arrive</span><span style="font-size:0.6em; color:var(--body);">Visitor reaches the gate</span></div><div class="row" style="display:flex; align-items:center; gap:14px; padding:7px 0;"><span style="font-family:'Outfit'; font-weight:800; font-size:0.68em; color:#3a3a3a; width:34px;">04</span><span style="font-size:0.72em; color:#fff; width:120px;">Verify</span><span style="font-size:0.6em; color:var(--body);">Security verifies identity</span></div><div class="row" style="display:flex; align-items:center; gap:14px; padding:7px 0;"><span style="font-family:'Outfit'; font-weight:800; font-size:0.68em; color:#e9b96b; width:34px;">05</span><span style="font-size:0.72em; color:#fff; width:120px;">Check-in</span><span style="font-size:0.6em; color:var(--body);">Visit becomes active</span></div><div class="row" style="display:flex; align-items:center; gap:14px; padding:7px 0;"><span style="font-family:'Outfit'; font-weight:800; font-size:0.68em; color:#e9b96b; width:34px;">06</span><span style="font-size:0.72em; color:#fff; width:120px;">Monitor</span><span style="font-size:0.6em; color:var(--body);">Visible as currently inside</span></div><div class="row" style="display:flex; align-items:center; gap:14px; padding:7px 0;"><span style="font-family:'Outfit'; font-weight:800; font-size:0.68em; color:#e9b96b; width:34px;">07</span><span style="font-size:0.72em; color:#fff; width:120px;">Check-out</span><span style="font-size:0.6em; color:var(--body);">Visit closed and recorded</span></div></div>
  <div class="card" style="flex:0.85; padding:16px 18px;"><div class="lbl" style="color:#555; margin-bottom:10px;">WHAT MANAGEMENT GETS</div><div style="display:flex; align-items:center; gap:9px; padding:7px 0; border-bottom:1px solid #111; font-size:0.65em; color:#ddd;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#e9b96b"/></svg>Who is expected — before they arrive</div><div style="display:flex; align-items:center; gap:9px; padding:7px 0; border-bottom:1px solid #111; font-size:0.65em; color:#ddd;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#22c55e"/></svg>Who is inside — right now</div><div style="display:flex; align-items:center; gap:9px; padding:7px 0; border-bottom:1px solid #111; font-size:0.65em; color:#ddd;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#666"/></svg>Who has left — with the time</div><div style="display:flex; align-items:center; gap:9px; padding:7px 0; border-bottom:1px solid #111; font-size:0.65em; color:#ddd;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#f5a623"/></svg>What is pending a decision</div><div style="display:flex; align-items:center; gap:9px; padding:7px 0; font-size:0.65em; color:#ddd;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#818cf8"/></svg>What happened — on the record, afterwards</div><div style="margin-top:14px; border-left:2px solid #e9b96b; padding-left:14px; font-size:0.64em; color:#bbb;">One visitor. Seven steps. Nothing on paper.</div></div>
</div>

<!--
DEMONSTRATE THIS IN THE PRODUCT — do not present the slide and move on.
Follow exactly ONE visitor. Narrate outcomes, not the interface: say "management can now see
this person as currently inside", never "this is our visitor dashboard".
DO NOT click into unrelated features, settings or reports. If a screen loads slowly, keep
talking through the step rather than filling the silence with a different screen.
TRANSITION, close to verbatim: "The same principle applies to material movement — but with an
additional accountability requirement: what happens when the material is expected to come back?"
-->

---

### 07 · Live Demonstration

![bg brightness:0.05](https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600)

# From Gate-Out to Final Closure

<div style="display:flex; gap:14px; margin-top:16px;">
  <div style="flex:1.25;"><div class="card" style="padding:14px 18px; border-top:2px solid #06b6d4;"><div style="display:flex; align-items:center;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.78em; color:#fff;">RGP-00125</span><span style="font-size:0.6em; color:var(--label); margin-left:10px;">3 laptops sent for repair</span><span class="tag" style="background:#22c55e12; color:#22c55e; border:1px solid #22c55e26; margin-left:auto;">Closed</span></div><div style="display:flex; padding:10px 0 6px; border-bottom:1px solid #1a1a1a; font-family:'Outfit'; font-weight:600; font-size:0.42em; letter-spacing:0.14em; color:#555;"><span style="flex:2;">ITEM</span><span style="flex:1; text-align:right;">SENT</span><span style="flex:1; text-align:right;">RETURNED</span><span style="flex:1; text-align:right;">OUTSTANDING</span></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em; color:#ccc;"><span style="flex:2;">Laptop A</span><span style="flex:1; text-align:right;">1</span><span style="flex:1; text-align:right; color:#22c55e;">1</span><span style="flex:1; text-align:right;">0</span></div><div class="row" style="display:flex; padding:7px 0; border-bottom:1px solid #111; font-size:0.64em; color:#ccc;"><span style="flex:2;">Laptop B</span><span style="flex:1; text-align:right;">1</span><span style="flex:1; text-align:right; color:#22c55e;">1</span><span style="flex:1; text-align:right;">0</span></div><div class="row" style="display:flex; padding:7px 0; font-size:0.64em; color:#ccc;"><span style="flex:2;">Laptop C</span><span style="flex:1; text-align:right;">1</span><span style="flex:1; text-align:right; color:#22c55e;">1</span><span style="flex:1; text-align:right;">0</span></div><div style="display:flex; gap:4px; margin-top:12px;"><div class="step" style="border-color:#22c55e22; color:#22c55e;">Approved</div><div class="step" style="border-color:#22c55e22; color:#22c55e;">Gate Out</div><div class="step" style="border-color:#22c55e22; color:#22c55e;">Outside</div><div class="step" style="border-color:#22c55e22; color:#22c55e;">Returned</div><div class="step" style="border-color:#22c55e22; color:#22c55e;">Closed</div></div></div><div class="card" style="padding:14px 18px; border-top:2px solid #818cf8; margin-top:12px;"><div style="display:flex; align-items:center;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="1.6"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span style="font-family:'Outfit'; font-weight:600; font-size:0.72em; color:#fff; margin-left:9px;">The exception — only two come back</span><span class="tag" style="background:#818cf812; color:#818cf8; border:1px solid #818cf826; margin-left:auto;">Partially Returned</span></div><div style="display:flex; gap:10px; margin-top:12px;"><div style="flex:1; text-align:center; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:9px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.4em; color:#fff; line-height:1;">3</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.4em; letter-spacing:0.16em; color:#555; margin-top:5px;">SENT</div></div><div style="flex:1; text-align:center; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:9px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.4em; color:#22c55e; line-height:1;">2</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.4em; letter-spacing:0.16em; color:#555; margin-top:5px;">RETURNED</div></div><div style="flex:1; text-align:center; background:#0b0b0b; border:1px solid #f5a62333; border-radius:8px; padding:9px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.4em; color:#f5a623; line-height:1;">1</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.4em; letter-spacing:0.16em; color:#555; margin-top:5px;">OUTSTANDING</div></div></div><div style="font-size:0.6em; color:#888; margin-top:10px;">The pass does not close. The obligation stays visible.</div></div></div>
  <div style="flex:0.75;"><div class="card" style="padding:16px 18px;"><div class="lbl" style="color:#818cf8; margin-bottom:10px;">NRGP · PERMANENT EXIT</div><div class="row" style="display:flex; align-items:baseline; gap:10px; border-left:2px solid #818cf844; padding:5px 0 5px 12px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.44em; color:#818cf8;">01</span><span style="font-size:0.68em; color:#ddd;">Request</span></div><div class="row" style="display:flex; align-items:baseline; gap:10px; border-left:2px solid #818cf844; padding:5px 0 5px 12px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.44em; color:#818cf8;">02</span><span style="font-size:0.68em; color:#ddd;">Approval</span></div><div class="row" style="display:flex; align-items:baseline; gap:10px; border-left:2px solid #818cf844; padding:5px 0 5px 12px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.44em; color:#818cf8;">03</span><span style="font-size:0.68em; color:#ddd;">Gate Verification</span></div><div class="row" style="display:flex; align-items:baseline; gap:10px; border-left:2px solid #818cf844; padding:5px 0 5px 12px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.44em; color:#818cf8;">04</span><span style="font-size:0.68em; color:#ddd;">Gate Out</span></div><div class="row" style="display:flex; align-items:baseline; gap:10px; border-left:2px solid #818cf844; padding:5px 0 5px 12px;"><span style="font-family:'Outfit'; font-weight:700; font-size:0.44em; color:#818cf8;">05</span><span style="font-size:0.68em; color:#ddd;">Clearance</span></div></div><div class="quote" style="margin-top:12px; font-size:0.7em;">This is where the system moves beyond <strong>pass generation</strong> into <strong>material accountability</strong>.</div></div>
</div>

<!--
THE MOST IMPORTANT SLIDE IN THE DECK — demonstrate both flows live.
Story: "Let's follow three laptops from approval through return." Complete the happy path first.
THEN deliberately return only two, and let the room watch the pass refuse to close.
SAY: "This gives management visibility into material currently outside, material returned, and
items still outstanding." Never say "this is our RGP dashboard".
EMPHASISE: generating a pass is the easy half. Reconciliation is the half that protects assets.
Transition: "Now put both streams on one screen."
-->

---

### 08 · Executive Control Tower

# One Screen. One Operational Picture.

<div style="background:linear-gradient(180deg,#0a0a0a,#050505); border:1px solid #1a1a1a; border-radius:14px; padding:14px 18px; margin-top:14px;">
  <div style="display:flex; gap:22px; align-items:center; border-bottom:1px solid #141414; padding-bottom:9px; margin-bottom:14px; font-family:'Outfit'; font-weight:600; font-size:0.44em; letter-spacing:0.18em;"><span style="color:#fff; border-bottom:2px solid #06b6d4; padding-bottom:9px; margin-bottom:-11px;">OVERVIEW</span><span style="color:#444;">PEOPLE</span><span style="color:#444;">MATERIALS</span><span style="color:#444;">APPROVALS</span><span style="color:#444;">EXCEPTIONS</span><span style="color:#444;">AUDIT</span><span style="margin-left:auto;"><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Illustrative data</span></span></div>
  <div style="display:flex; gap:14px;"><div style="flex:1.35;"><div class="lbl" style="color:#e9b96b; margin-bottom:7px;">PEOPLE · TODAY</div><div style="display:flex; gap:8px;"><div style="flex:1; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#e9b96b; line-height:1;">35</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">VISITORS</div></div><div style="flex:1; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#e9b96b; line-height:1;">17</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">INSIDE</div></div><div style="flex:1; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#e9b96b; line-height:1;">4</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">PENDING</div></div><div style="flex:1; background:#0b0b0b; border:1px solid #f5a62333; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#f5a623; line-height:1;">2</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">EXCEPTIONS</div></div></div><div class="lbl" style="color:#22d3ee; margin:14px 0 7px;">MATERIAL · TODAY</div><div style="display:flex; gap:8px;"><div style="flex:1; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#22d3ee; line-height:1;">5</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">RGP OUTSIDE</div></div><div style="flex:1; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#22c55e; line-height:1;">9</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">RGP RETURNED</div></div><div style="flex:1; background:#0b0b0b; border:1px solid #f5a62333; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#f5a623; line-height:1;">2</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">OUTSTANDING</div></div><div style="flex:1; background:#0b0b0b; border:1px solid #151515; border-radius:8px; padding:10px 12px;"><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#818cf8; line-height:1;">8</div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#555; margin-top:6px;">NRGP CLEARED</div></div></div><div style="display:flex; align-items:flex-end; gap:5px; height:76px; margin-top:18px;"><div style="flex:1; height:22%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:38%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:66%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:100%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:74%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:52%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:44%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:30%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div><div style="flex:1; height:18%; background:linear-gradient(180deg,#e9b96b,#6b5227); border-radius:2px 2px 0 0;"></div></div><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#444; margin-top:7px;">VISITOR ARRIVALS BY HOUR · 09:00 → 18:00</div></div><div style="flex:0.6; display:flex; flex-direction:column; gap:10px;"><div style="text-align:center; background:#0b0b0b; border:1px solid #151515; border-radius:10px; padding:10px;"><svg width="104" height="104" viewBox="0 0 200 200"><circle cx="100" cy="100" r="74" fill="none" stroke="#161616" stroke-width="17"/><circle cx="100" cy="100" r="74" fill="none" stroke="#22c55e" stroke-width="17" stroke-linecap="round" stroke-dasharray="465" stroke-dashoffset="121" transform="rotate(-90 100 100)"/><text x="100" y="95" text-anchor="middle" font-family="Outfit" font-weight="800" font-size="44" fill="#ffffff">74%</text><text x="100" y="122" text-anchor="middle" font-family="Outfit" font-weight="600" font-size="14" letter-spacing="2" fill="#666">RECONCILED</text></svg><div style="font-family:'Outfit'; font-weight:600; font-size:0.38em; letter-spacing:0.14em; color:#444;">RGP RETURN RATE</div></div><div style="background:#0b0b0b; border:1px solid #f5a62333; border-radius:10px; padding:12px 14px; flex:1;"><div class="lbl" style="color:#f5a623; margin-bottom:9px;">ATTENTION REQUIRED</div><div style="display:flex; align-items:center; gap:8px; font-size:0.6em; color:#ddd; padding:4px 0;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#ef4444"/></svg>2 overdue RGPs</div><div style="display:flex; align-items:center; gap:8px; font-size:0.6em; color:#ddd; padding:4px 0;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#818cf8"/></svg>1 partially returned RGP</div><div style="display:flex; align-items:center; gap:8px; font-size:0.6em; color:#ddd; padding:4px 0;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#e9b96b"/></svg>4 pending visitor approvals</div><div style="display:flex; align-items:center; gap:8px; font-size:0.6em; color:#ddd; padding:4px 0;"><svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#f5a623"/></svg>2 gate exceptions</div></div></div></div>
</div>

<div class="quote" style="margin-top:14px; font-size:0.72em;">The platform is designed to provide a <strong>centralized operational picture</strong> of the gate — people and material, in one place.</div>

<!--
Strongest visual moment after the cover. Let it sit for two seconds before speaking.
STATE CLEARLY, unprompted: "these figures are illustrative — your numbers come from your own
operation."
SAY: "Management no longer depends on fragmented updates to understand what is happening at the
gate." Do NOT assert that their current process is fragmented — say "designed to provide".
EMPHASISE the Attention Required panel. That is the executive value; the counters are not.
Transition: "Which brings us to the practical question — what does adoption look like?"
-->

---

### 09 · Enterprise Readiness &amp; Implementation

# From Evaluation to Implementation

<div class="lbl" style="color:#22d3ee; margin-top:10px;">01 · ENTERPRISE CONTROL</div>

<div style="display:flex; gap:10px; margin-top:9px;">
  <div class="card row" style="flex:1; padding:11px 14px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><div style="font-family:'Outfit'; font-weight:700; font-size:0.54em; letter-spacing:0.14em; color:#fff; margin-top:8px;">ACCESS</div><div style="font-size:0.58em; color:var(--body); margin-top:5px; line-height:1.55;">Role-based access — guard, department head, admin, executive</div></div>
  <div class="card row" style="flex:1; padding:11px 14px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div style="font-family:'Outfit'; font-weight:700; font-size:0.54em; letter-spacing:0.14em; color:#fff; margin-top:8px;">GOVERNANCE</div><div style="font-size:0.58em; color:var(--body); margin-top:5px; line-height:1.55;">Defined approval workflows before any movement is permitted</div></div>
  <div class="card row" style="flex:1; padding:11px 14px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div style="font-family:'Outfit'; font-weight:700; font-size:0.54em; letter-spacing:0.14em; color:#fff; margin-top:8px;">AUDIT</div><div style="font-size:0.58em; color:var(--body); margin-top:5px; line-height:1.55;">Traceable activity history — actions attributed and timestamped</div></div>
  <div class="card row" style="flex:1; padding:11px 14px;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><div style="font-family:'Outfit'; font-weight:700; font-size:0.54em; letter-spacing:0.14em; color:#fff; margin-top:8px;">SECURITY</div><div style="font-size:0.58em; color:var(--body); margin-top:5px; line-height:1.55;">Authentication and server-enforced authorization on every record</div></div>
</div>

<div class="lbl" style="color:#22d3ee; margin-top:14px;">02 · IMPLEMENTATION</div>

<div style="display:flex; gap:5px; margin-top:9px;"><div class="step">Discover</div><div class="chev">›</div><div class="step">Configure</div><div class="chev">›</div><div class="step">Integrate</div><div class="chev">›</div><div class="step">Pilot</div><div class="chev">›</div><div class="step">Train</div><div class="chev">›</div><div class="step">Go-Live</div><div class="chev">›</div><div class="step">Optimize</div></div>

<div style="display:flex; align-items:center; gap:10px; margin-top:9px;"><span style="font-size:0.58em; color:#888;">Sequence confirmed. Duration to be agreed in discovery.</span><span class="tag" style="background:#f5a6230f; color:#f5a623; border:1px solid #f5a62322;">Validate before presentation</span></div>

<div style="display:flex; align-items:center; gap:12px; margin-top:13px;"><span class="lbl" style="color:#22d3ee; white-space:nowrap;">03 · OUTCOME</span><span class="tag" style="background:#06b6d412; color:#22d3ee; border:1px solid #06b6d426;">Visibility</span><span class="tag" style="background:#06b6d412; color:#22d3ee; border:1px solid #06b6d426;">Control</span><span class="tag" style="background:#06b6d412; color:#22d3ee; border:1px solid #06b6d426;">Accountability</span><span class="tag" style="background:#06b6d412; color:#22d3ee; border:1px solid #06b6d426;">Efficiency</span><span class="tag" style="background:#06b6d412; color:#22d3ee; border:1px solid #06b6d426;">Data</span></div>

<div style="display:flex; align-items:center; gap:28px; margin-top:14px; background:linear-gradient(90deg,#0b0b0b,#050505); border:1px solid #1a1a1a; border-left:2px solid #06b6d4; border-radius:12px; padding:14px 22px;">
  <div><div style="font-family:'Outfit'; font-weight:800; font-size:1.3em; color:#fff; line-height:1.05; letter-spacing:-0.03em; white-space:nowrap;">ONE GATE.<br>COMPLETE VISIBILITY.</div><div style="font-family:'Raleway'; font-weight:100; font-size:0.66em; color:#ffffff66; margin-top:6px;">From evaluation to implementation.</div></div>
  <div style="border-left:1px solid #1a1a1a; padding-left:28px;"><div class="lbl" style="color:#22d3ee;">PROPOSED NEXT STEP</div><div style="font-size:0.68em; color:#ddd; margin-top:7px; line-height:1.6;">A scoping session to confirm gates, departments,<br>approval authority and pilot scope.</div></div>
</div>

<!--
Confidence without overclaiming, then the ask. All four controls are implemented: access is
role-based, approvals are enforced before movement, activity is attributed and timestamped, and
authorization is enforced on the server rather than only in the interface.
DO NOT claim certifications, encryption standards, compliance frameworks, or a deployment
duration. If pressed on timeline: "that is the first output of discovery — we would rather size
it against your gates than quote a number now."
CLOSE — do not thank the room, close on the decision. SAY: "You have seen both systems work.
The remaining question is not whether they function — it is when you want the gate to start
producing this information." Then ask for the scoping session explicitly and STOP TALKING.
Let them respond first. If commercials come up, take it offline: this meeting's objective is
agreement on the next step, not the price.
-->
