interface RateLimitState {
  failedAttempts: { timestamp: number }[];
  pageLoads: { timestamp: number }[];
  lockedUntil: number;
}

const STORAGE_KEY = 'sg_rate_limit';
const MAX_FAILED = 5;
const MAX_PAGE_LOADS = 20;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_STEPS = [0, 0, 0, 0, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000];

function load(): RateLimitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RateLimitState;
  } catch { /* corrupt data */ }
  return { failedAttempts: [], pageLoads: [], lockedUntil: 0 };
}

function save(state: RateLimitState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function trim(arr: { timestamp: number }[]): { timestamp: number }[] {
  const cutoff = Date.now() - WINDOW_MS;
  return arr.filter((e) => e.timestamp > cutoff);
}

function lockoutDuration(attempts: number): number {
  if (attempts <= 0) return 0;
  const idx = Math.min(attempts - 1, LOCKOUT_STEPS.length - 1);
  return LOCKOUT_STEPS[idx] ?? 1_800_000;
}

export function getRateLimit(): { blocked: boolean; message: string; remainingSeconds: number } {
  const state = load();
  const now = Date.now();

  if (state.lockedUntil > now) {
    const remaining = Math.ceil((state.lockedUntil - now) / 1000);
    return { blocked: true, message: `Too many login attempts. Try again in ${remaining}s.`, remainingSeconds: remaining };
  }

  state.failedAttempts = trim(state.failedAttempts);
  state.pageLoads = trim(state.pageLoads);

  if (state.failedAttempts.length >= MAX_FAILED) {
    const dur = lockoutDuration(state.failedAttempts.length);
    state.lockedUntil = now + dur;
    save(state);
    const remaining = Math.ceil(dur / 1000);
    return { blocked: true, message: `Too many login attempts. Try again in ${remaining}s.`, remainingSeconds: remaining };
  }

  if (state.pageLoads.length >= MAX_PAGE_LOADS) {
    const remaining = Math.ceil(WINDOW_MS / 1000);
    return { blocked: true, message: `Suspicious activity detected. Try again later.`, remainingSeconds: remaining };
  }

  return { blocked: false, message: '', remainingSeconds: 0 };
}

export function recordFailedAttempt(): void {
  const state = load();
  state.failedAttempts = trim(state.failedAttempts);
  state.failedAttempts.push({ timestamp: Date.now() });
  const dur = lockoutDuration(state.failedAttempts.length);
  if (dur > 0) state.lockedUntil = Date.now() + dur;
  save(state);
}

export function recordPageLoad(): void {
  const state = load();
  state.pageLoads = trim(state.pageLoads);
  state.pageLoads.push({ timestamp: Date.now() });
  save(state);
}

export function resetRateLimit(): void {
  localStorage.removeItem(STORAGE_KEY);
}
