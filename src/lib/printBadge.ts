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
  /* ONE SHEET (client report, 2026-08-15: "scattered across three pages").
     The page box was 80mm x 120mm — narrower and much shorter than the card
     itself, which is 320px (~85mm) wide and taller than 120mm once it carries
     the photo, the identity block and the QR. Anything that does not fit a page
     box does not shrink, it spills, so the pass came out of the printer in
     strips. A4 portrait is the box every office printer actually has loaded;
     the card is centred on it and break-inside:avoid keeps it whole. */
  @page { size: A4 portrait; margin: 10mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { display: flex; justify-content: center; align-items: flex-start; padding: 6mm 0; }
  .print-only { display: block !important; }
  /* Keep the card whole: a badge split across two sheets is not a badge. */
  #${PRINT_BADGE_ID} { break-inside: avoid; page-break-inside: avoid; }
  #${PRINT_BADGE_ID} * { break-inside: avoid; page-break-inside: avoid; }
  /* The one element that must not be allowed to grow: a percentage-height
     image inside a circular frame can reflow taller on paper than on screen,
     which is enough to push the QR onto a second sheet. */
  #${PRINT_BADGE_ID} img { max-width: 100%; }
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
