// Turns a stored visitor photo into something jsPDF can actually embed.
//
// Two things make the raw value unusable as-is:
//   * Format. photoUpload.ts stores captures as WebP. jsPDF has no WebP
//     decoder at all — handing it one throws, which is why the photo silently
//     never appeared on the pass.
//   * Location. `photo_data` is usually a *signed https URL*, not a data URL.
//     jsPDF cannot fetch a remote image; it only accepts bytes it already has.
//
// So we load the image ourselves and re-encode it through a canvas to PNG,
// which jsPDF does understand. Remote sources need crossOrigin so the canvas
// is not tainted — a tainted canvas makes toDataURL throw SecurityError, which
// would land us right back where we started.
//
// Everything here is best-effort by design: a pass with no photo is still a
// usable pass, so every failure path returns null rather than throwing.

/** Longest edge of the re-encoded image. The pass draws it at 60x72pt; this keeps enough detail to print without embedding a multi-megabyte capture. */
const MAX_EDGE = 480;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only for remote sources: setting crossOrigin on a data: URL is harmless
    // but pointless, and on some browsers slows the decode path down.
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load pass photo'));
    img.src = src;
  });
}

/** Re-encodes `source` (data URL or remote URL, any format the browser can decode) as a PNG data URL. Resolves to null if it cannot be loaded, drawn or exported. */
export async function toPdfSafeImage(source: string): Promise<string | null> {
  try {
    const img = await loadImage(source);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
