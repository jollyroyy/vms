// CHECK for goal.md S1, S2a, S4, S6, S7, S12a, S13a, S14 (🎯) — the Milestone A demo path.
//
// Playwright spec. Named *.e2e.ts so vitest ignores it; runs via `npm run test:e2e`
// once Playwright is installed (loop iteration: "seed script + demo dry-run").
// All tests start as fixme (red). Un-fixme each one in the iteration that builds its flow.
//
// Precondition for every test: `npm run seed` has produced pristine demo data.
// Webcam: launch Chromium with --use-fake-device-for-media-stream so FR-CAM capture
// works headlessly without hardware.
import { test } from '@playwright/test';

test.describe('S1: walk-in visitor — the demo centerpiece', () => {
  test.fixme('guard registers visitor with webcam photo (preview + retake)', async () => {});
  test.fixme('HOD (mobile viewport) sees pending approval WITH the photo and approves', async () => {});
  test.fixme('badge renders with photo, VIS ref number and QR; entry time logged', async () => {});
  test.fixme('guard logs exit; visit closes with server-side out-time', async () => {});
});

test.describe('S2a: rejection', () => {
  test.fixme('HOD rejects with reason; guard console shows rejection live', async () => {});
});

test.describe('S4: gate pass — 4 types', () => {
  test.fixme('visitor-linked RGP-Inward: one HOD approval covers visitor + material', async () => {});
  test.fixme('outward NRGP: staff request → HOD approval → guard marks dispatched → closed', async () => {});
  test.fixme('outward RGP: stays open awaiting return; guard logs return; pass closes', async () => {});
});

test.describe('S6: who\'s-inside board (realtime)', () => {
  test.fixme('check-in appears on the live board without refresh; disappears on check-out', async () => {});
});

test.describe('S7: blacklist + repeat recall', () => {
  test.fixme('blacklisted phone number triggers red alert on registration', async () => {});
  test.fixme('returning visitor phone number auto-fills name, company, photo', async () => {});
});

test.describe('S12a: daily visitor register', () => {
  test.fixme('register lists today\'s visits with in/out times and statuses', async () => {});
});

test.describe('S14: demo readiness', () => {
  test.fixme('seed reset restores pristine demo data; demo script click-path runs clean twice in a row', async () => {});
});
