export function safeErrorMessage(err: unknown, fallback = 'An unexpected error occurred.'): string {
  if (err == null) return fallback;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in (err as object)) {
    try { return String((err as { message: unknown }).message); } catch { return fallback; }
  }
  if (typeof err === 'object') {
    try { return JSON.stringify(err); } catch { return fallback; }
  }
  return String(err);
}
