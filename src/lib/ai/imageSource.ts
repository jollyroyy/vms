// Turns any of our ImageSource variants into the encoded ArrayBuffer the
// inference engines want.
//
// Kept separate from the engines because both OCR and face need it, and because
// it is the one piece of this subsystem that is pure DOM work with no model
// involved — easy to test, and it would otherwise be duplicated twice.
import type { ImageSource } from './types';

/** Encoding used for the intermediate buffer. PNG is lossless: JPEG artefacts
 *  around thin strokes measurably cost OCR accuracy on small print, which is
 *  exactly what an ID card is. */
const ENCODE_TYPE = 'image/png';

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  if (width <= 0 || height <= 0) {
    throw new Error('Cannot read image: source has zero width or height');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToArrayBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas encoding failed')); return; }
      blob.arrayBuffer().then(resolve, reject);
    }, ENCODE_TYPE);
  });
}

export async function toArrayBuffer(image: ImageSource): Promise<ArrayBuffer> {
  if (image instanceof Blob) return image.arrayBuffer();

  if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) {
    return canvasToArrayBuffer(image);
  }

  if (typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement) {
    // videoWidth, not clientWidth: the element's CSS size is whatever the layout
    // made it, while the frame we want is the camera's native resolution.
    return canvasToArrayBuffer(drawToCanvas(image, image.videoWidth, image.videoHeight));
  }

  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
    return canvasToArrayBuffer(drawToCanvas(image, image.width, image.height));
  }

  throw new Error('Unsupported image source');
}
