export function exportToCsv<T extends Record<string, unknown>>(data: T[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]!);
  const csvRows = [headers.join(',')];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      const str = val == null ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename, 'text/csv');
}

export function exportToJson<T>(data: T[], filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadFile(blob, filename, 'application/json');
}

function downloadFile(blob: Blob, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
