export interface NetworkDiagnostic {
  at: number;
  server: string | null;
  /** Used only to scope this in-memory view, never included in the copied report. */
  accountId: string | null;
  feature: string;
  method: string;
  code: string;
  requestId?: string;
  status?: number;
  durationMs: number;
  attempted: boolean;
}

const entries: NetworkDiagnostic[] = [];
export function recordNetworkDiagnostic(entry: NetworkDiagnostic): void {
  entries.push(entry);
  if (entries.length > 30) entries.shift();
}
export const recentNetworkDiagnostics = (server: string | null, accountId: string | null) => entries.filter((entry) => entry.server === server && entry.accountId === accountId).slice(-12);
