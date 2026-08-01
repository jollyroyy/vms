// Copies the onnxruntime-web WASM runtime out of node_modules and into
// public/ort/, where the app self-hosts it.
//
// Why not just let onnxruntime-web fetch its own runtime? Because it defaults to
// a jsDelivr CDN, and our Content-Security-Policy allows scripts and connections
// from 'self' and Supabase only. The CDN fetch is blocked, and the failure
// arrives as an opaque WASM load error rather than anything mentioning CSP.
//
// Why not commit the .wasm to git? It is 13 MB, and it must match the installed
// onnxruntime-web version exactly — a stale committed binary against an upgraded
// package is a genuinely horrible bug to track down. Copying at build time makes
// the version mismatch impossible.
//
// Runs automatically via the predev/prebuild npm scripts.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const to = join(root, 'public', 'ort');

// The single-threaded SIMD builds. We deliberately do NOT enable cross-origin
// isolation (COOP/COEP), because `require-corp` would break loading Supabase
// images, so multi-threading is unavailable and the threaded binaries would be
// dead weight. ORT falls back to one thread on its own.
// The .jsep variant is required since onnxruntime-web 1.20 — it is the default
// runtime the library dynamically imports; without it the CPU backend never
// registers and the scan fails with "no available backend found".
const ASSETS = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];

if (!existsSync(from)) {
  console.error('[sync-ort-assets] onnxruntime-web not installed — run npm install first.');
  process.exit(1);
}

mkdirSync(to, { recursive: true });

let copied = 0;
for (const asset of ASSETS) {
  const src = join(from, asset);
  if (!existsSync(src)) {
    console.error(`[sync-ort-assets] missing ${asset} in onnxruntime-web/dist.`);
    console.error('[sync-ort-assets] The package layout changed; update ASSETS in this script.');
    process.exit(1);
  }
  copyFileSync(src, join(to, asset));
  copied += statSync(src).size;
}

console.log(`[sync-ort-assets] copied ${ASSETS.length} files (${(copied / 1e6).toFixed(1)} MB) to public/ort/`);
