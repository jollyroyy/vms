// Print the visitor pass that is already on screen.
//
// The printed pass is the existing badge markup in a print-only window — the
// white card the guard is looking at IS the asset that goes to the printer, so
// the gate and the kiosk can never disagree about what a pass looks like.
//
// Extracted out of GuardLiveQueue.tsx when the Entry & Exit lanes landed: it is
// DOM plumbing with no knowledge of a visit, and the page it lived in was at
// the 300-line ceiling.

/** The element the badge rail renders the printable pass into. */
export const PRINT_BADGE_ID = 'vms-print-badge';

export function printVisitorBadge(): void {
  const el = document.getElementById(PRINT_BADGE_ID);
  if (!el) return;
  const w = window.open('', '_blank', 'width=480,height=720');
  if (!w) return;
  w.document.write(
    `<html><head><title>Visitor Pass</title><style>body{margin:0}img{max-width:100%}</style></head>` +
    `<body>${el.outerHTML}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}
