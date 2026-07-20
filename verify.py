#!/usr/bin/env python3
"""
verify.py — VMS goal-driven test verifier

Runs every check. Never stops early. Reports each result clearly.
At the end prints a summary and either:
  ALL TESTS PASSED       (exit 0 — git commit allowed)
  X CHECK(S) NOT PASSED  (exit 1 — git commit blocked)

Usage:
  python3 verify.py          # run all checks
  python3 verify.py --goal   # also print which goal criteria are still unmet
"""

import subprocess
import sys
import os
import re
from pathlib import Path

# Force UTF-8 output on Windows (default console is cp1252)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ── ANSI colours (disabled automatically when not a terminal) ────────────────
USE_COLOUR = sys.stdout.isatty()

def c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOUR else text

def green(t):  return c("32;1", t)
def red(t):    return c("31;1", t)
def yellow(t): return c("33", t)
def bold(t):   return c("1", t)
def dim(t):    return c("2", t)

LINE  = "─" * 56
DLINE = "═" * 56

# ── Checks (each maps directly to a goal.md §2.2 criterion layer) ────────────
CHECKS = [
    {
        "label":       "TypeScript",
        "goal":        "No type errors anywhere in src/  (goal.md §2.1)",
        "cmd":         ["npx", "tsc", "--noEmit"],
    },
    {
        "label":       "Unit tests",
        "goal":        "Pure logic: ref numbers, status machines, due dates, blacklist, photo crop  (goal.md §7)",
        "cmd":         ["npx", "vitest", "run", "tests/unit"],
    },
    {
        "label":       "Security tests",
        "goal":        "RLS denials, photo-privacy 403s, server-auth data  (goal.md SEC-1/2/3/5)",
        "cmd":         ["npx", "vitest", "run", "tests/security"],
    },
    {
        "label":       "Milestone A goals",
        "goal":        "All 🎯 criteria in goal.md §2.2 checked off — DEMO-READY",
        "fn":          "milestone_a",
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────
def pending_count() -> int:
    p = Path("tests/pending.list")
    if not p.exists():
        return 0
    lines = [l.strip() for l in p.read_text().splitlines()]
    return sum(1 for l in lines if l and not l.startswith("#"))

def goal_progress() -> tuple[int, int]:
    """Returns (done, total) for Milestone A (🎯) criteria."""
    g = Path("goal.md")
    if not g.exists():
        return 0, 0
    lines = g.read_text(encoding="utf-8").splitlines()
    criteria = [l for l in lines if re.search(r"- \[[ x]\] 🎯", l)]
    done     = [l for l in criteria if re.search(r"- \[x\]", l)]
    return len(done), len(criteria)

def unmet_goals() -> list[str]:
    """Returns the text of unchecked 🎯 criteria."""
    g = Path("goal.md")
    if not g.exists():
        return []
    lines = g.read_text(encoding="utf-8").splitlines()
    return [
        re.sub(r"^- \[ \] 🎯 \*\*(.*?)\*\*.*", r"\1", l).strip()
        for l in lines
        if re.search(r"- \[ \] 🎯", l)
    ]

def run_milestone_a_check() -> bool:
    """Inline check: every 🎯 criterion in goal.md §2.2 must be ticked [x]."""
    unmet = unmet_goals()
    if not unmet:
        print(green("  All Milestone A (🎯) criteria are checked off in goal.md."))
        return True
    print(red(f"\n  {len(unmet)} Milestone A criterion/criteria NOT yet met:"))
    for i, g in enumerate(unmet, 1):
        print(red(f"     {i}. {g}"))
    print(yellow("\n  → Tick each checkbox in goal.md §2.2 ONLY after observing the"))
    print(yellow("     behaviour end-to-end in a running browser (goal.md §3 Step 6)."))
    print(yellow("     'ALL TESTS PASSED' cannot be true while goals remain unmet."))
    return False

def run_check(check: dict) -> bool:
    """Run one check. Print its output live. Return True if passed."""
    if check.get("fn") == "milestone_a":
        return run_milestone_a_check()
    env = {**os.environ, "FORCE_COLOR": "1"}
    # On Windows, npx/tsc/vitest are .cmd files — must use shell=True.
    # Join to a single string so no argument escaping issues arise
    # (all args here are controlled constants, not user input).
    is_windows = sys.platform == "win32"
    cmd = " ".join(check["cmd"]) if is_windows else check["cmd"]
    result = subprocess.run(cmd, env=env, shell=is_windows)
    return result.returncode == 0

# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> int:
    show_goals = "--goal" in sys.argv
    done, total = goal_progress()
    pending     = pending_count()

    print(bold("\n╔══════════════════════════════════════════════════════╗"))
    print(bold(  "║         VMS Checker  —  goal-driven test gate        ║"))
    print(bold(  "╚══════════════════════════════════════════════════════╝"))
    print(dim(f"\n  Goal progress  : {done} / {total} Milestone A criteria met"))
    print(dim(f"  Pending suites : {pending} queued in tests/pending.list"))
    print(dim( '\n  Loop question  : "Which goal is not yet met,'))
    print(dim( '                    and what would prove it is?"\n'))

    results: list[tuple[dict, bool]] = []

    for i, check in enumerate(CHECKS, 1):
        print(bold(f"\n{LINE}"))
        print(bold(f"  Check {i} of {len(CHECKS)}  —  {check['label']}"))
        print(dim( f"  {check['goal']}"))
        if "cmd" in check:
            print(dim(f"  $ {' '.join(check['cmd'])}"))
        print(bold(f"{LINE}\n"))

        passed = run_check(check)
        results.append((check, passed))

        if passed:
            print(green(f"\n  ✔  {check['label']}: PASSED"))
        else:
            print(red(   f"\n  ✖  {check['label']}: NOT PASSED"))
            print(yellow(  "     → Before writing a fix: search memory.md for a matching error pattern."))
            print(yellow(  "     → If a pattern matches, apply the listed Fix directly (do not experiment)."))
            print(yellow(  "     → If no pattern matches, fix it, then record the new pattern in memory.md."))
            print(yellow(  "     → Do not move to the next goal until this passes."))

    # ── Summary ───────────────────────────────────────────────────────────────
    failed  = [(c, p) for c, p in results if not p]
    n_pass  = len(results) - len(failed)

    print(bold(f"\n{DLINE}"))
    print(bold(  "  SUMMARY"))
    print(bold(f"{DLINE}"))

    for check, passed in results:
        icon   = green("✔") if passed else red("✖")
        label  = green(check["label"]) if passed else red(check["label"])
        status = green("PASSED") if passed else red("NOT PASSED")
        print(f"  {icon}  {label:<35} {status}")

    print(bold(f"{DLINE}"))

    if not failed:
        print(green(bold("\n  ✔  ALL TESTS PASSED")))
        if pending:
            print(green(dim(f"     ({pending} suite(s) still queued — activate next for the next goal)")))
        print(green(bold(f"     Goal: {done} / {total} Milestone A criteria checked off\n")))

        if show_goals:
            unmet = unmet_goals()
            if unmet:
                print(bold("  Next unmet goal criteria (Milestone A):"))
                for i, g in enumerate(unmet, 1):
                    print(dim(f"    {i}. {g}"))
                print()

        return 0

    else:
        print(red(bold(f"\n  ✖  {len(failed)} CHECK(S) NOT PASSED:")))
        for check, _ in failed:
            print(red(f"       • {check['label']}"))
            print(red(dim(f"         {check['goal']}")))
        print()
        print(yellow(bold("  Loop action (goal.md §3 Step 5):")))
        print(yellow(    "  Fix the failing check(s) above and run verify.py again."))
        print(yellow(    "  Do not move to the next goal criterion with a failing check."))
        print(yellow(    "  After 3 failed attempts → decompose or flag Blocked (needs human)."))
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
