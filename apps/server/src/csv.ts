/**
 * N-17: the personal export as one CSV file. One row per record, a `category` column first
 * (drinks, water, checkIns, expenses...), then the union of every category's fields. A spreadsheet
 * filters on the first column; a single file is what a phone's share sheet can pass on.
 */

type Row = Record<string, unknown>;

/**
 * RFC 4180 quoting. A text cell starting with = + - @ (or a tab or carriage return) gets a leading
 * apostrophe, so a spreadsheet never runs a name or a description as a formula.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Every array (or single object) of the export becomes rows of its category. Scalars are skipped. */
export function exportToCsv(data: Record<string, unknown>): string {
  const rows: { category: string; row: Row }[] = [];
  for (const [category, value] of Object.entries(data)) {
    if (Array.isArray(value)) for (const item of value) rows.push({ category, row: item && typeof item === "object" ? (item as Row) : { value: item } });
    else if (value && typeof value === "object") rows.push({ category, row: value as Row });
  }
  const columns: string[] = [];
  for (const { row } of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const lines = [["category", ...columns].map(csvCell).join(",")];
  for (const { category, row } of rows) lines.push([category, ...columns.map((c) => row[c])].map(csvCell).join(","));
  // CRLF as RFC 4180 says, which every spreadsheet opens.
  return `${lines.join("\r\n")}\r\n`;
}
