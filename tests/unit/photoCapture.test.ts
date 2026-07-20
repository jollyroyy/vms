// CHECK for goal.md S1 photo pipeline + S11 (🏭 full resilience) — FR ref: FR-CAM-08
// Pipeline: native capture → center-crop 3:4 portrait → 480×640 → ≤200 KB.
import { describe, it, expect } from 'vitest';
import { computeCenterCrop, PHOTO_CONSTRAINTS } from '../../src/lib/photo';

describe('FR-CAM-08: photo constraints', () => {
  it('targets 480×640 portrait at ≤200 KB', () => {
    expect(PHOTO_CONSTRAINTS.width).toBe(480);
    expect(PHOTO_CONSTRAINTS.height).toBe(640);
    expect(PHOTO_CONSTRAINTS.maxBytes).toBe(200 * 1024);
  });
});

describe('FR-CAM-08: center-crop math (landscape webcam → 3:4 portrait)', () => {
  it('crops a 1280×720 landscape frame to a centered 3:4 window', () => {
    const crop = computeCenterCrop(1280, 720);
    expect(crop.height).toBe(720);
    expect(crop.width).toBe(540); // 720 * 3/4
    expect(crop.x).toBe(370); // (1280 - 540) / 2
    expect(crop.y).toBe(0);
  });

  it('crops a portrait tablet frame (720×1280) without upscaling', () => {
    const crop = computeCenterCrop(720, 1280);
    expect(crop.width).toBe(720);
    expect(crop.height).toBe(960); // 720 * 4/3
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(160); // (1280 - 960) / 2
  });

  it('handles an exactly-3:4 source as a no-op crop', () => {
    const crop = computeCenterCrop(480, 640);
    expect(crop).toEqual({ x: 0, y: 0, width: 480, height: 640 });
  });

  it('rejects zero/negative dimensions', () => {
    expect(() => computeCenterCrop(0, 720)).toThrow();
    expect(() => computeCenterCrop(1280, -1)).toThrow();
  });
});
