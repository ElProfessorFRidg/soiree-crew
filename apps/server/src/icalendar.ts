/**
 * N-06: a minimal RFC 5545 writer for the crew calendar feed. Only what calendar apps need:
 * VCALENDAR with timed (UTC) or all-day VEVENTs, escaped text and lines folded at 75 octets.
 */

export interface CalendarEvent {
  uid: string;
  /** Timed event, ms UTC. */
  start?: number;
  end?: number;
  /** All-day event, YYYY-MM-DD (end exclusive). */
  date?: string;
  summary: string;
  description?: string | undefined;
  location?: string | undefined;
  /** Last change, ms UTC. */
  updatedAt: number;
  cancelled?: boolean;
}

/** TEXT values: backslash, semicolon, comma and line breaks are escaped (RFC 5545 3.3.11). */
export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets, never inside a UTF-8 sequence (RFC 5545 3.1). */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = Buffer.byteLength(char, "utf8");
    // The first line holds 75 octets; continuation lines start with a space, so 74 more.
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  out.push(current);
  return out.join("\r\n ");
}

const utc = (at: number) => new Date(at).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (key: string) => key.replace(/-/g, "");
function nextDay(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function buildCalendar(options: { name: string; now: number; events: readonly CalendarEvent[] }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Soiree Crew//Crew calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    // Calendar apps poll the feed; an hour keeps new parties showing up the same evening.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of options.events) {
    lines.push("BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${utc(options.now)}`, `LAST-MODIFIED:${utc(event.updatedAt)}`);
    if (event.date) lines.push(`DTSTART;VALUE=DATE:${day(event.date)}`, `DTEND;VALUE=DATE:${day(nextDay(event.date))}`);
    else lines.push(`DTSTART:${utc(event.start!)}`, `DTEND:${utc(event.end ?? event.start!)}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push(`STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
