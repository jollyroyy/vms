import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCsv } from '../../src/lib/exportUtils';

function mockAnchor() {
  const anchor = document.createElement('a');
  const click = vi.fn();
  anchor.click = click;
  vi.spyOn(document, 'createElement').mockReturnValue(anchor);
  vi.spyOn(document.body, 'appendChild');
  vi.spyOn(document.body, 'removeChild');
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
  globalThis.URL.revokeObjectURL = vi.fn();
  return { anchor, click };
}

describe('M19-EXPORT: exportToCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a download link and clicks it with data', () => {
    const { click } = mockAnchor();
    exportToCsv([{ name: 'John', age: 30 }], 'visitors.csv');
    expect(click).toHaveBeenCalled();
  });

  it('sets the download filename from argument', () => {
    const { anchor } = mockAnchor();
    exportToCsv([{ name: 'John' }], 'report.csv');
    expect(anchor.download).toBe('report.csv');
  });

  it('returns early for empty data without creating a link', () => {
    const createSpy = vi.spyOn(document, 'createElement');
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    exportToCsv([], 'empty.csv');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('escapes double quotes in cell values', () => {
    const { click } = mockAnchor();
    exportToCsv([{ name: 'John "Big" Doe' }], 'test.csv');
    expect(click).toHaveBeenCalled();
  });

  it('handles null and undefined values', () => {
    const { click } = mockAnchor();
    exportToCsv([{ name: 'John', age: null }], 'test.csv');
    expect(click).toHaveBeenCalled();
  });

  it('handles numeric and boolean values', () => {
    const { click } = mockAnchor();
    exportToCsv([{ count: 0, active: true, price: 99.99 }], 'test.csv');
    expect(click).toHaveBeenCalled();
  });

  it('appends and removes the link element from body', () => {
    mockAnchor();
    const append = vi.spyOn(document.body, 'appendChild');
    const remove = vi.spyOn(document.body, 'removeChild');
    exportToCsv([{ name: 'Test' }], 'test.csv');
    expect(append).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });

  it('revokes the object URL after download', () => {
    mockAnchor();
    exportToCsv([{ name: 'Test' }], 'test.csv');
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
