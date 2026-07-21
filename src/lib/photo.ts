// S1 photo pipeline / FR-CAM-08 — center-crop math for webcam capture.
// The browser capture module uses these values; the actual canvas ops happen in the UI layer.

export const PHOTO_CONSTRAINTS = {
  width: 480,
  height: 640,
  maxBytes: 200 * 1024, // 200 KB
} as const;

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Compute the largest centered 3:4 portrait rectangle that fits inside the source frame.
// No upscaling: the crop never exceeds the source dimensions.
export function computeCenterCrop(sourceWidth: number, sourceHeight: number): CropRect {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(`Invalid dimensions: ${sourceWidth}×${sourceHeight}`);
  }

  // Option A: use full height, shrink width to match 3:4 ratio.
  const wFromH = Math.floor(sourceHeight * 3 / 4);
  if (wFromH <= sourceWidth) {
    return {
      width: wFromH,
      height: sourceHeight,
      x: Math.floor((sourceWidth - wFromH) / 2),
      y: 0,
    };
  }

  // Option B: use full width, shrink height to match 3:4 ratio.
  const hFromW = Math.floor(sourceWidth * 4 / 3);
  return {
    width: sourceWidth,
    height: hFromW,
    x: 0,
    y: Math.floor((sourceHeight - hFromW) / 2),
  };
}

/**
 * Strip EXIF/GPS metadata from an image file by re-encoding through canvas.
 * Returns a new Blob (WebP) with no metadata.
 * SEC-EXIF: Prevents GPS coordinates and camera metadata from being stored with visitor photos.
 */
export async function stripExifViaCanvas(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Apply center-crop and resize to target dimensions
      const crop = computeCenterCrop(img.naturalWidth, img.naturalHeight);
      canvas.width = PHOTO_CONSTRAINTS.width;
      canvas.height = PHOTO_CONSTRAINTS.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(objectUrl); reject(new Error('Canvas not available')); return; }
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          resolve(blob);
        },
        'image/webp',
        0.8,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}
