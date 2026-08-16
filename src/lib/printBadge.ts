// Print the visitor pass that is already on screen.
//
// The printed pass is the existing badge markup (components/Badge.tsx) in its
// own window, so the gate and the kiosk can never disagree about what a pass
// looks like. That was the intent from the start — but until 2026-08-15 it was
// not what happened, and the client's report ("clicking print badge doesn't
// show the page properly") was exactly right:
//
//   * The popup was written with `body{margin:0}img{max-width:100%}` and
//     NOTHING ELSE. Every Tailwind class in the copied markup resolved to
//     nothing, so what reached the printer was unstyled text with three loose
//     images — no card, no colour, no layout.
//   * `w.print()` fired on the same tick as `document.write`. The logo, the
//     visitor photo and the QR had not decoded yet, so even the images were
//     regularly missing from the sheet.
//
// Both are fixed by carrying the real stylesheets across and waiting for the
// images. The badge markup itself stays the single source of truth.

/** The element the badge rail renders the printable pass into. */
export const PRINT_BADGE_ID = 'vms-print-badge';

/** Give up waiting on a stylesheet or an image rather than never printing. A
 *  pass that reaches the printer plain beats a button that does nothing. */
const ASSET_TIMEOUT_MS = 3000;

/** Every stylesheet the app is currently using, as markup the popup can adopt.
 *
 *  Both forms have to be handled: Vite serves CSS as inline <style> in dev and
 *  as a <link> to a hashed asset in a build, so taking only one of them would
 *  work in exactly one environment — the class of bug this file already had. */
function styleTags(): string {
  return Array.from(
    document.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]'),
  )
    .map((node) => node.outerHTML)
    .join('\n');
}

/** Overrides that apply to the badge sheet only.
 *
 *  `.print-only` is `display:none` on screen (base.css) and the popup is not
 *  printing yet when it first renders, so without this the window opens blank.
 *  The page box is portrait and badge-sized: print.css sets A4 LANDSCAPE for the
 *  reports register, which would set a 90mm card adrift on a sideways sheet. */
const BADGE_PRINT_CSS = `
  /* FULL SHEET, not a business card centred on one (client instruction,
     2026-08-16: the pass must "appear throughout the entire screen"). The card
     is authored at max-w-[320px] because that is the width of the rail it
     previews inside; on paper that constraint is meaningless and produced a
     stamp-sized badge marooned in the middle of an A4 page. The width cap is
     lifted and the card is allowed to fill the printable box.

     It still has to stay on ONE sheet (2026-08-15 report: "scattered across
     three pages"), which is why this is max-width plus height:100% and never a
     transform:scale() — a scale factor is a guess that spills the moment a
     visitor has a long name or an extra line renders. */
  @page { size: A4 portrait; margin: 8mm; }
  html, body { margin: 0; padding: 0; background: #fff; width: 100%; height: 100%; }
  body { display: block; }
  .print-only { display: block !important; }

  #${PRINT_BADGE_ID} {
    /* Override the rail's own mx-auto w-full max-w-[320px]. !important is
       required: those are utility classes carried across from the app's real
       stylesheet, and they are just as specific as anything written here. */
    max-width: none !important;
    width: 100% !important;
    height: 100%;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  #${PRINT_BADGE_ID} * { break-inside: avoid; page-break-inside: avoid; }

  /* Scale the type to the sheet. A card designed for a 320px column prints at
     roughly 8pt if left alone, which is a pass nobody can read across a gate
     desk. These are the same elements, addressed by the size classes the card
     already uses, so the visual hierarchy is preserved rather than re-invented. */
  #${PRINT_BADGE_ID} .text-xl  { font-size: 30pt !important; line-height: 1.15 !important; }
  #${PRINT_BADGE_ID} .text-lg  { font-size: 22pt !important; }
  #${PRINT_BADGE_ID} .text-base { font-size: 18pt !important; }
  #${PRINT_BADGE_ID} .text-sm  { font-size: 15pt !important; }
  #${PRINT_BADGE_ID} .text-\\[11px\\] { font-size: 14pt !important; }
  #${PRINT_BADGE_ID} .text-\\[9px\\]  { font-size: 10pt !important; }

  /* The blue band runs the full width of the sheet, as it does on the card. */
  #${PRINT_BADGE_ID} > div:nth-child(2) { padding: 6mm 0 !important; }

  /* The QR is the one element on the pass a machine reads. Give it a size that
     survives being folded into a pocket and scanned off paper. */
  #vms-print-badge-qr {
    width: 62mm !important;
    height: 62mm !important;
    margin-top: 8mm !important;
  }

  #${PRINT_BADGE_ID} img { max-width: 100%; }
  /* The issuing wordmark's logo is fixed-size on screen; let it grow with the
     rest rather than sitting as a thumbnail beside 30pt type. */
  #${PRINT_BADGE_ID} .h-9 { height: 22mm !important; width: 24mm !important; }

  /* Paper cannot re-create a backdrop filter, and the browser drops background
     colour by default — the band and the QR quiet zone are load-bearing here,
     so ask for them explicitly. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
`;

/** Resolves once every image in the document has loaded or failed. */
function imagesSettled(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
      ),
    ).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ASSET_TIMEOUT_MS)),
  ]);
}

export function printVisitorBadge(): void {
  const el = document.getElementById(PRINT_BADGE_ID);
  if (!el) return;
  // MAXIMIZED (client instruction, 2026-08-15). It opened at 420x680, a window
  // narrower than the print preview it exists to show — the guard saw a
  // letterboxed sliver of the sheet and had to resize before they could tell
  // whether the pass was right. Sized to the usable screen instead, and moved
  // to its corner: a popup opened at full size is still positioned wherever the
  // browser feels like unless it is told.
  const width = window.screen?.availWidth ?? 1280;
  const height = window.screen?.availHeight ?? 900;
  const w = window.open('', '_blank', `width=${width},height=${height},left=0,top=0`);
  if (!w) return;
  // Belt and braces: Chrome honours the features string on open, Firefox often
  // does not, and neither reliably moves an already-open popup. Both calls are
  // no-ops when the browser refuses, which is why they are not guarded.
  try { w.moveTo(0, 0); w.resizeTo(width, height); } catch { /* popup geometry is advisory */ }

  w.document.write(
    '<!doctype html><html><head><meta charset="utf-8" />' +
      '<title>Visitor Pass</title>' +
      styleTags() +
      `<style>${BADGE_PRINT_CSS}</style>` +
      // Light, always. The badge is near-black on white by design and the
      // theme's dark palette would print a near-white card on a dark ground —
      // a sheet of toner for a pass nobody can read.
      '</head><body class="light">' +
      el.outerHTML +
      '</body></html>',
  );
  w.document.close();

  void imagesSettled(w.document).then(() => {
    w.focus();
    w.print();
  });
}
