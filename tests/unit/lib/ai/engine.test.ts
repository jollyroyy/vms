import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createOcrEngine, createFaceEngine } = vi.hoisted(() => ({
  createOcrEngine: vi.fn(),
  createFaceEngine: vi.fn(),
}));

vi.mock('../../../../src/lib/ai/ocrEngine', () => ({ createOcrEngine }));
vi.mock('../../../../src/lib/ai/faceEngine', () => ({ createFaceEngine }));

import { getEngine, resetEngineCache } from '../../../../src/lib/ai/engine';

describe('M-AI-ENGINE: getEngine', () => {
  it('returns an AiEngine with the browser-wasm id', () => {
    resetEngineCache();
    expect(getEngine().id).toBe('browser-wasm');
  });

  it('returns the same engine object on subsequent calls', () => {
    resetEngineCache();
    const a = getEngine();
    const b = getEngine();
    expect(b).toBe(a);
  });
});

describe('M-AI-ENGINE: ocr() lazy loading and caching', () => {
  beforeEach(() => {
    resetEngineCache();
    createOcrEngine.mockClear();
    createFaceEngine.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call createOcrEngine until ocr() is called', () => {
    createOcrEngine.mockImplementation(() =>
      Promise.resolve({ recognise: vi.fn() })
    );
    const engine = getEngine();
    expect(createOcrEngine).not.toHaveBeenCalled();
  });

  it('calls createOcrEngine exactly once and caches the result', async () => {
    createOcrEngine.mockImplementation(() =>
      Promise.resolve({ recognise: vi.fn() })
    );
    const engine = getEngine();
    const p1 = engine.ocr();
    const p2 = engine.ocr();
    expect(p1).toBe(p2);
    const r = await p1;
    await p2;
    expect(createOcrEngine).toHaveBeenCalledTimes(1);
    expect(r).toBeDefined();
  });

  it('clears the cached promise on failure so a retry re-invokes createOcrEngine', async () => {
    createOcrEngine.mockImplementation(() =>
      Promise.reject(new Error('load failed'))
    );
    const engine = getEngine();

    await expect(engine.ocr()).rejects.toThrow('load failed');
    await expect(engine.ocr()).rejects.toThrow('load failed');
    expect(createOcrEngine).toHaveBeenCalledTimes(2);

    resetEngineCache();
    await expect(engine.ocr()).rejects.toThrow('load failed');
    expect(createOcrEngine).toHaveBeenCalledTimes(3);
  });
});

describe('M-AI-ENGINE: face() lazy loading and caching', () => {
  beforeEach(() => {
    resetEngineCache();
    createOcrEngine.mockClear();
    createFaceEngine.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call createFaceEngine until face() is called', () => {
    createFaceEngine.mockImplementation(() =>
      Promise.resolve({ detect: vi.fn(), embed: vi.fn() })
    );
    const engine = getEngine();
    expect(createFaceEngine).not.toHaveBeenCalled();
  });

  it('calls createFaceEngine exactly once and caches the result', async () => {
    createFaceEngine.mockImplementation(() =>
      Promise.resolve({ detect: vi.fn(), embed: vi.fn() })
    );
    const engine = getEngine();
    const p1 = engine.face();
    const p2 = engine.face();
    expect(p1).toBe(p2);
    await p1;
    await p2;
    expect(createFaceEngine).toHaveBeenCalledTimes(1);
  });

  it('clears the cached promise on failure so a retry re-invokes createFaceEngine', async () => {
    createFaceEngine.mockImplementation(() =>
      Promise.reject(new Error('face load failed'))
    );
    const engine = getEngine();

    await expect(engine.face()).rejects.toThrow('face load failed');
    await expect(engine.face()).rejects.toThrow('face load failed');
    expect(createFaceEngine).toHaveBeenCalledTimes(2);

    resetEngineCache();
    await expect(engine.face()).rejects.toThrow('face load failed');
    expect(createFaceEngine).toHaveBeenCalledTimes(3);
  });
});

describe('M-AI-ENGINE: resetEngineCache', () => {
  beforeEach(() => {
    resetEngineCache();
    createOcrEngine.mockClear();
    createFaceEngine.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears both ocr and face caches so they re-load on next call', async () => {
    createOcrEngine.mockImplementation(() =>
      Promise.resolve({ recognise: vi.fn() })
    );
    createFaceEngine.mockImplementation(() =>
      Promise.resolve({ detect: vi.fn(), embed: vi.fn() })
    );
    const engine = getEngine();

    await engine.ocr();
    await engine.face();
    expect(createOcrEngine).toHaveBeenCalledTimes(1);
    expect(createFaceEngine).toHaveBeenCalledTimes(1);

    // Second call without reset — should be cached
    await engine.ocr();
    await engine.face();
    expect(createOcrEngine).toHaveBeenCalledTimes(1);
    expect(createFaceEngine).toHaveBeenCalledTimes(1);

    resetEngineCache();

    // After reset — should re-load
    await engine.ocr();
    await engine.face();
    expect(createOcrEngine).toHaveBeenCalledTimes(2);
    expect(createFaceEngine).toHaveBeenCalledTimes(2);
  });
});
