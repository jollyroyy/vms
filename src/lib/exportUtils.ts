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
  // THE BOM IS WHAT MAKES THE FILE READABLE, not decoration. Excel guesses a
  // CSV's encoding from the locale's ANSI code page unless the file announces
  // itself, so a UTF-8 byte lands as "â€”" / "â€¢" — the exact gibberish that
  // was showing up in the exported register. A leading U+FEFF is the one
  // signal Excel, LibreOffice and Numbers all honour, and every other reader
  // treats it as an invisible zero-width space.
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, filename, 'text/csv');
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
