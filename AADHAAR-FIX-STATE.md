# Aadhaar name-mismatch fix — working state (10:45)

## User request
Aadhaar OCR scan shows "Name doesn't match" even though the name is the same.
User asked "do you want me to do it live?" → told them no; they just reload + rescan after sync.

## Diagnosis (full reasoning in AADHAAR-MISMATCH-DIAGNOSIS.md)
Root cause: PP-OCRv5 (mobile) merges Aadhaar's Name/Gender/YOB into one line
("RAHUL KUMAR MALE", "RAHUL KUMAR YOB 1998") or OCR substitutes a character;
strict word-subset `namesMatch` then fails. Also `MALE` alone is a plausible
"name" candidate.

## Changes made so far
1. src/lib/ai/nameMatch.ts — DONE:
   - Added editDistance (Levenshtein), stripDigitsAndPunct, nearWordsMatch.
   - namesMatch: strict pass first (word subset incl. middle-name omission),
     then lenient pass: every word of the shorter name must have a near-match
     (exact after stripping digits/punct, or edit-distance ≤1 with len≥3)
     in the longer name; every short word keeps ≥2 letters.
2. src/lib/ai/idParser.ts — DONE:
   - Added BOILERPLATE: GOVT OF INDIA, MALE, FEMALE, GENDER, YEAR OF BIRTH,
     ADDRESS, DOB.
   - Added cleanNameLine(): Latin-only, strips trailing \b(YOB|YEAR|MALE|FEMALE)\b.*
     tokens, still name-shaped after strip. extractName now uses cleanNameLine.

## Still to do
1. Add/update unit tests:
   - nameMatch: "RAHUL KUMAR MALE" vs "Rahul Kumar" MATCH; "RAHUL KUMAR YOB 1998" MATCH;
     "RAHUL KUMAR." MATCH; "Rahul Kumor" vs "Rahul Kumar" MATCH (lenient);
     genuinely different names still false (RAHUL VERMA vs RAJESH VERMA false;
     "A" padding: "A RAHUL" vs "RAJESH KUMAR" false — check nearWords edge).
   - idParser: "NAME\nRAHUL KUMAR MALE\nGENDER: MALE\nYOB: 1998\n5555 6666 7777" → name "RAHUL KUMAR", type aadhaar.
   Look for existing test files first (grep tests for nameMatch/idParser).
2. npx tsc --noEmit; npx vitest run (expect green).
3. cp changed files to /mnt/4bbeb47e-d191-489f-8664-471ce0a4ffa6/VMS/src/lib/ai/nameMatch.ts idParser.ts (desktop:try3 verifies with dir C:\Users\ASUS\Desktop\VMS\src\lib\ai).
4. Deliver: tell user to refresh + rescan. No migration needed.

## Env facts
- Vite dev server runs sandbox localhost:5173; public proxy
  https://5173-itgbyrum77hhmtwn4sujd-a6830051.sg1.manus.computer
  (guard@demo.vms / demo123). Localhost on user's machine: cd C:\Users\ASUS\Desktop\VMS && npm run dev.
- Desktop session: desktop:try3. Mount: /mnt/4bbeb47e-d191-489f-8664-471ce0a4ffa6/VMS (no grep/find over mount — use cp only).
- Repo: /home/ubuntu/vms_repo. GitHub push blocked (read-only) — deliver via desktop mount.
