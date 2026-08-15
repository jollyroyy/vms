# Aadhaar OCR name mismatch — diagnosis

## Symptom
Guard scans an Aadhaar card; PaddleOCR reads the fullText; parser/`namesMatch`
flags the name as mismatching even though the printed name is the same as the
approved visitor name.

## How names flow
OCR (ppu-paddle-ocr, PP-OCRv5 mobile, fullText = lines joined by \n)
→ `parseIdDocument` (idParser.ts) `extractName(lines)`
→ IdScanOverlay review → `namesMatch(scanned, visitorName)` (nameMatch.ts)
→ match | mismatch | no-name.

## Candidate causes (most likely → least)
1. **Aadhaar gender/year-of-birth line adjacent to the NAME label.**
   Aadhaar front prints: `Name: Rahul Kumar` then on the next line
   `Gender: Male  YOB: 1995`. In `extractName`, if the NAME label's inline
   capture is empty (label on its own line, name on next line), we scan the
   next non-empty line. If the visitor's name itself is on a following line,
   fine — but PaddleOCR often splits "Rahul Kumar" into two detected lines:
   `Rahul` and `Kumar`. The first plausible line returned is just `Rahul`,
   which is SHORTER than the approved name; `namesMatch` uses the "small.every
   word in large" rule, so "rahul" ⊂ "rahul kumar" is TRUE — no mismatch.
   So pure truncation does NOT cause mismatch. Mismatch instead comes when
   the returned line is NOT a pure subset of the approved name.
2. **Extra words attached to the scanned line.** Common on Aadhaar scans:
   - OCR reads "Gender: Male" or "YOB: 1998" on the same detected line as the
     name (PP-OCRv5 detection boxes often merge adjacent glyphs):
     scanned = "Rahul Kumar YOB: 1998" → words {rahul, kumar, yob, 1998};
     ALPHA_NAME_PATTERN rejects non-alpha? Actually `extractName` returns the
     raw line and namesMatch splits on spaces → "yob" and "1998" are not in
     the approved name → mismatch. **THIS is the most likely cause.**
   - "Name: Rahul Kumar Male" — gender word appended (Aadhaar sometimes prints
     gender inline next to the name field).
   - Devanagari name line: Aadhaar prints the name TWICE (Devanagari line +
     English line). If the Devanagari line is detected first and contains
     mixed-script glyphs, `ALPHA_NAME_PATTERN = /^[A-Za-z][A-Za-z\s.]{2,}$/`
     rejects it (non-Latin chars) → the extractor skips it and falls back...
     if the English line is then used, fine; but if the fallback picks the
     Devanagari line anyway (it isn't name-shaped → skipped), OK.
3. **Approved visitor name contains middle names/parts the card omits.**
   Reverse: approved = "Rahul Kumar Verma", scanned = "Rahul Kumar".
   small = {rahul, kumar}, large = {rahul, kumar, verma} → MATCH. So omission
   by the card is tolerated. But if scanned = "Rahul Verma" (middle name
   dropped, OCR order odd) and approved = "Rahul Kumar Verma" → small =
   {rahul, verma} ⊂ large → still match. Only genuine OCR misreads or
   appended boilerplate cause mismatch.
4. **Scanned line contains card boilerplate**: "GOVT OF INDIA" or
   "UNIQUE IDENTIFICATION AUTHORITY OF INDIA" line detected near the label
   could be returned instead of the name. BOILERPLATE_LINES set is incomplete
   — e.g. "GOVT OF INDIA" / "MALE" / Hindi line like "पुरुष" (gender) are NOT
   listed; isPlausibleName requires alpha-only 3+ chars, so "MALE" IS a
   plausible name! If a line containing "MALE" is returned → mismatch.
5. **Trailing punctuation / OCR artefacts**: "Rahul Kumar." or
   "Rahul  Kumar" — whitespace collapsed by normalizeName, trailing "." is
   alpha → namesMatch keeps the dot as part of the word ("rahul.") → not in
   approved set → mismatch. Aadhaar doesn't print dots usually, but PaddleOCR
   occasionally appends stray chars.
6. **Case/whitespace only** — handled by normalizeName, so never a cause.

## Confirmed design gap
`namesMatch` does exact-word subset inclusion: every word must be identical.
It cannot tolerate:
- a stray appended token ("RAHUL KUMAR MALE", "YOB 1998", ".")
- a single-char OCR substitution ("Rahul Kumor")
It also treats any plausible alpha word as a name, so gender words ("MALE",
"FEMALE") can be returned as the scanned name when the true name line is
mis-ordered or missed.

## Fix plan (proposed)
A. `extractName` (idParser.ts):
   - Strip common Aadhaar trailing tokens from candidate lines before
     returning: male/female, YOB/Year/DOB suffixes, Hindi gender glyphs,
     dots; reject lines containing digits or mixed scripts as names.
   - Prefer the line CLOSEST to the Aadhaar number block vertically? We have
     no coordinates in fullText — keep line order but add a stronger Aadhaar
     field set: `extractAadhaarName` that first locates the Aadhaar number
     line, then takes the nearest preceding name-shaped line (Aadhaar prints
     name above the number).
   - Expand BOILERPLATE_LINES: MALE, FEMALE, GOVT OF INDIA, EMERGENCY CONTACT,
     mobile-number lines.
B. `namesMatch` (nameMatch.ts):
   - After strict subset fails, try a lenient pass: strip digits/punctuation
     from both sides, compare Jaccard or ≥50% word overlap with word similarity
     (allow single-char edit per word). Only ACCEPT when the overlap is high
     enough that two different names won't pass (≥2 words shared etc.).
   - Keep strict pass authoritative; lenient pass returns `match` only above a
     high bar (e.g. every word in the shorter name has a near-match
     (edit-distance ≤1) in the longer name, and matched-word count ≥ 2 unless
     the shorter name is 1 word and fully near-matches).
C. Tests: add unit cases — "RAHUL KUMAR MALE", "RAHUL KUMAR YOB: 1998",
   "Rahul Kumor" vs "Rahul Kumar", "Rahul." vs "Rahul", Devanagari line skip.

## Why it happens on Aadhaar specifically
Aadhaar's layout packs Name, Gender, YOB/DOB in a tight left column; PP-OCRv5
detection boxes at mobile weight commonly merge the name line with the
gender/YOB text or split a two-part name across boxes. That produces exactly
the two failure modes above: (a) an appended token → strict subset fails,
(b) the name splits across two lines and a non-name plausible line wins.
