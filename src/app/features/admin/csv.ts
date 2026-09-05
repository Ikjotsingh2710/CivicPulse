/**
 * Minimal CSV export for the control desk.
 *
 * Written by hand rather than pulled from a dependency: the dashboard needs one
 * function, and a spreadsheet export is not worth a package in the bundle.
 */

/** RFC 4180 quoting. Everything is quoted, which is always valid and avoids
 *  having to reason about which characters happen to need it. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));

  // Excel reads a bare UTF-8 CSV as the local codepage and mangles names with
  // accents; the BOM is what makes it open the file correctly.
  return '﻿' + lines.join('\r\n');
}

/** Triggers a browser download named `<prefix>-<yyyy-mm-dd>.csv`. */
export function downloadCsv(
  prefix: string,
  headers: readonly string[],
  rows: readonly unknown[][],
): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  // Revoking immediately can cancel the download in some browsers; one turn of
  // the event loop is enough for the click to have been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
