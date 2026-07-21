export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDuration(checkedInAt: string | null | undefined): { text: string; isOvertime: boolean } {
  if (!checkedInAt) return { text: '—', isOvertime: false };
  const ms = Date.now() - new Date(checkedInAt).getTime();
  if (ms < 0) return { text: '0m', isOvertime: false };
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return { text: `${hours}h ${minutes}m`, isOvertime: hours >= 9 };
  return { text: `${minutes}m`, isOvertime: false };
}
