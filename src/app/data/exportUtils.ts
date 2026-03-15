interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

function normalizeCsvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const headerRow = columns.map((column) => normalizeCsvValue(column.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => normalizeCsvValue(column.value(row))).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = buildCsv(rows, columns);
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}
