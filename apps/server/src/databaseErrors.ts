/** Only infrastructure/schema failures are translated. Constraint and bad-input codes stay intact. */
export class DatabaseFailure extends Error {
  constructor(readonly diagnosticCode: string, override readonly cause: unknown) {
    super("database_unavailable", { cause });
  }
}

export function classifyDatabaseFailure(error: unknown): unknown {
  if (error instanceof DatabaseFailure) return error;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string") return error;
  const diagnosticCode = ["42P01", "42703", "42883"].includes(code) ? "SC_DB_02"
    : code.startsWith("28") || code === "ERR_INVALID_URL" ? "SC_DB_03"
    : code === "57014" ? "SC_DB_04"
    : code.startsWith("08") || ["57P01", "57P02", "57P03", "53300", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"].includes(code) ? "SC_DB_01"
    : code === "42601" ? "SC_DB_05" : null;
  return diagnosticCode ? new DatabaseFailure(diagnosticCode, error) : error;
}

export async function databaseCall<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) { throw classifyDatabaseFailure(error); }
}
