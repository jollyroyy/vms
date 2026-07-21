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

describe('M7-PHOTO: edge cases', () => {
  it('crops a 1920×1080 Full HD landscape frame correctly', () => {
    const crop = computeCenterCrop(1920, 1080);
    expect(crop.height).toBe(1080);
    expect(crop.width).toBe(810); // 1080 * 3/4
    expect(crop.x).toBe(555); // (1920 - 810) / 2
    expect(crop.y).toBe(0);
  });

  it('crops a square frame (1:1) to 3:4 portrait', () => {
    const crop = computeCenterCrop(800, 800);
    expect(crop.width).toBe(600); // 800 * 3/4
    expect(crop.height).toBe(800);
    expect(crop.x).toBe(100);
    expect(crop.y).toBe(0);
  });

  it('crops a 4:3 landscape frame (standard monitor)', () => {
    const crop = computeCenterCrop(1600, 1200);
    expect(crop.width).toBe(900); // 1200 * 3/4
    expect(crop.height).toBe(1200);
    expect(crop.x).toBe(350);
    expect(crop.y).toBe(0);
  });

  it('handles exactly 3:4 at a larger resolution than target', () => {
    const crop = computeCenterCrop(1200, 1600);
    expect(crop).toEqual({ x: 0, y: 0, width: 1200, height: 1600 });
  });

  it('handles an ultra-wide cinema frame (21:9)', () => {
    const crop = computeCenterCrop(2560, 1080);
    expect(crop.height).toBe(1080);
    expect(crop.width).toBe(810);
    expect(crop.x).toBe(875);
    expect(crop.y).toBe(0);
  });

  it('handles a 5:4 monitor frame (1280×1024)', () => {
    const crop = computeCenterCrop(1280, 1024);
    expect(crop.width).toBe(768); // 1024 * 3/4
    expect(crop.height).toBe(1024);
    expect(crop.x).toBe(256);
    expect(crop.y).toBe(0);
  });
});
