// @vitest-environment node
//
// The installable-app contract: the files a phone reads BEFORE any React runs.
//
// Every assertion here is about something that fails silently in a browser. A
// manifest with a missing icon still parses and simply never offers to install;
// a `viewport` without `viewport-fit=cover` renders the app letterboxed on a
// notched phone with no error anywhere; an apple-touch-icon pointing at a file
// that is not there puts a screenshot of the page on the home screen instead.
// None of that shows up in a build, in a typecheck, or on a laptop.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = (...parts: string[]) => resolve(__dirname, '../..', ...parts);
const manifest = JSON.parse(readFileSync(root('public/manifest.webmanifest'), 'utf8'));
const html = readFileSync(root('index.html'), 'utf8');
const sw = readFileSync(root('public/sw.js'), 'utf8');
const indexCss = readFileSync(root('src/index.css'), 'utf8');

describe('PWA: the web app manifest', () => {
  it('declares the fields an install prompt needs', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    // Anything less than standalone keeps the browser's address bar, which is
    // the one visible difference between an app and a bookmark.
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBeTruthy();
    expect(manifest.theme_color).toBeTruthy();
  });

  it('ships a 192, a 512 and a maskable icon, and every file is on disk', () => {
    const icons: Array<{ src: string; sizes: string; purpose?: string }> = manifest.icons;
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512')).toBe(true);
    // Without a maskable icon Android drops the square PNG into its launcher
    // shape and draws a white border around whatever is left.
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of icons) {
      expect(existsSync(root('public', icon.src.replace(/^\//, '')))).toBe(true);
    }
  });

  it('points its shortcuts at in-app paths', () => {
    for (const shortcut of manifest.shortcuts as Array<{ url: string }>) {
      expect(shortcut.url.startsWith('/')).toBe(true);
    }
  });
});

describe('PWA: index.html', () => {
  it('links the manifest', () => {
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/);
  });

  it('carries an apple-touch-icon that exists — Safari never reads the manifest for it', () => {
    const match = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(existsSync(root('public', match![1]!.replace(/^\//, '')))).toBe(true);
  });

  it('asks for the whole screen with viewport-fit=cover', () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/);
    expect(viewport).not.toBeNull();
    expect(viewport![1]).toContain('viewport-fit=cover');
  });

  it('declares ONE theme-color and no prefers-color-scheme pair', () => {
    // The theme is a stored choice, not the OS scheme (lib/theme.tsx), so a
    // media-split pair would paint the status bar the wrong colour for anybody
    // whose phone disagrees with their app setting. applyTheme() rewrites this
    // single tag from the --c-surface-50 token instead.
    const themeColors = html.match(/<meta name="theme-color"/g) ?? [];
    expect(themeColors).toHaveLength(1);
    expect(html).not.toMatch(/<meta name="theme-color"[^>]*media=/);
  });

  it('declares itself web-app capable for both platforms', () => {
    expect(html).toMatch(/<meta name="mobile-web-app-capable" content="yes"/);
    expect(html).toMatch(/<meta name="apple-mobile-web-app-capable" content="yes"/);
  });
});

describe('PWA: the service worker', () => {
  it('never caches the 52 MB of WASM engines in public/', () => {
    // These two directories are what makes a generated precache manifest the
    // wrong tool for this repo: onnxruntime and the OCR weights, neither of
    // which any HOD screen loads. Parsed rather than grepped, so the assertion
    // is about the list the worker actually consults.
    const declaration = sw.match(/const NEVER_CACHE = \[([^\]]*)\]/);
    expect(declaration).not.toBeNull();
    const prefixes = declaration![1]!
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    expect(prefixes).toContain('/ort/');
    expect(prefixes).toContain('/models/');
    // If either directory is ever renamed, this is where the stale exclusion
    // finds out: the whole point is that those paths are real.
    expect(existsSync(root('public/ort'))).toBe(true);
    expect(existsSync(root('public/models'))).toBe(true);
  });

  it('returns early for every other origin, so no Supabase response is ever stored', () => {
    // A cached auth token, or a cached list of who is on site, is worse than
    // having no service worker at all.
    expect(sw).toContain('url.origin !== self.location.origin');
  });

  it('serves navigations network-first, so a deploy is never invisible', () => {
    expect(sw).toMatch(/request\.mode === 'navigate'.*networkFirst/s);
  });
});

describe('PWA: the phone stylesheet', () => {
  it('is imported, and before @tailwind like every other layer file', () => {
    const importAt = indexCss.indexOf("@import './styles/mobile.css'");
    expect(importAt).toBeGreaterThan(-1);
    expect(importAt).toBeLessThan(indexCss.indexOf('@tailwind'));
  });

  it('pays back the safe-area inset that the cover viewport just took', () => {
    const css = readFileSync(root('src/styles/mobile.css'), 'utf8');
    expect(css).toContain('env(safe-area-inset-top');
    expect(css).toContain('env(safe-area-inset-bottom');
    // 16px on a coarse pointer, or iOS Safari zooms the page on field focus.
    expect(css).toMatch(/@media \(pointer: coarse\)/);
    expect(css).toMatch(/font-size:\s*16px/);
  });
});
