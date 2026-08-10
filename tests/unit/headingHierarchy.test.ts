// The client's complaint on 2026-08-10 was that "headings are not
// distinguishable, they look almost like the subtext". The cause was concrete:
// `.section-title` was an 11px uppercase micro-label used as a real <h2> in
// thirteen places, so a section heading rendered SMALLER than the body text
// underneath it.
//
// The fix is a ladder with real gaps — page 28 > section 22 > card 18 >
// body 14 > eyebrow 11 — and this spec exists so it cannot quietly collapse
// again. It asserts the stylesheet, not a render, because the whole point is
// the declared scale; jsdom does not resolve Tailwind classes to pixels.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const surfaces = readFileSync(
  resolve(__dirname, '../../src/styles/components-surfaces.css'),
  'utf8',
).replace(/\s+/g, ' ');

const ruleFor = (name: string) => {
  const m = surfaces.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
  expect(m, `no .${name} rule found in components-surfaces.css`).not.toBeNull();
  return m![1];
};

describe('heading hierarchy has real gaps between its rungs', () => {
  it('a page title is the largest step', () => {
    expect(ruleFor('page-title')).toMatch(/text-h1/);
  });

  it('a section heading is a real heading, not a micro-label', () => {
    const rule = ruleFor('section-title');
    expect(rule).toMatch(/text-h2/);
    // The exact regression being guarded: if this ever reads text-micro again,
    // section headings are back to being smaller than their own body text.
    expect(rule).not.toMatch(/text-micro/);
  });

  it('a card title sits one step below a section heading', () => {
    expect(ruleFor('card-title')).toMatch(/text-h3/);
  });

  it('the eyebrow keeps the micro size, so there is somewhere for labels to live', () => {
    // .section-title was doing double duty as both heading and eyebrow. This
    // class is what the genuine eyebrows moved to; without it they would drift
    // back onto a heading class.
    expect(ruleFor('eyebrow')).toMatch(/text-micro/);
  });

  it('a KPI numeral is the heaviest thing on the page and never the serif face', () => {
    const rule = ruleFor('stat-value');
    expect(rule).toMatch(/text-kpi/);
    expect(rule).toMatch(/tabular-nums/);
    // A serif numeral carries neither tabular figures nor a true 800, and a
    // KPI whose digits jitter as they tick reads as broken.
    expect(rule).not.toMatch(/font-display/);
  });

  it('the subtitle under a page title is far enough below it to read as subtext', () => {
    expect(ruleFor('page-subtitle')).toMatch(/text-caption/);
  });
});
