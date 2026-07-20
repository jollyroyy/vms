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
